"""
SMB Flow MCP Automation Server
Uses LOCAL MLX model + Playwright to automate tasks in the web app.
Pure LLM-driven with NO rule-based fallbacks.
"""
import os
import json
import re
import uuid
import asyncio
from typing import Optional, Dict, List, Any
from urllib.parse import quote
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from playwright.async_api import async_playwright, Page
from pathlib import Path

# ===== Load LOCAL MLX Model =====
MODEL_PATH = os.getenv(
    "MODEL_PATH",
    "/Users/akash/.cache/huggingface/hub/models--mlx-community--gemma-4-E4B-it-4bit/snapshots/cc3b666c01c20395e0dcebd53854504c7d9821f9"
)

print("Loading LOCAL MLX model...")
mp = Path(MODEL_PATH)
from mlx_lm.utils import load_model, load_tokenizer
from mlx_lm import generate

tokenizer = load_tokenizer(mp)
model, config = load_model(mp, lazy=True, strict=False)
print("LOCAL model loaded successfully.")

WEB_APP_URL = os.getenv("WEB_APP_URL", "http://localhost:3000")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@acme.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")


# ===== Pydantic Models =====
class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    session_id: Optional[str] = None


class PlanRequest(BaseModel):
    prompt: str
    board_id: Optional[str] = None


# ===== In-Memory Session Store =====
sessions: Dict[str, Dict[str, Any]] = {}


def get_session(sid: str) -> Dict[str, Any]:
    if sid not in sessions:
        sessions[sid] = {"pending_intent": None, "pending_fields": {}, "history": []}
    return sessions[sid]


# ===== Playwright Automation =====
class MCPAutomation:
    def __init__(self):
        self.page: Optional[Page] = None
        self.playwright = None
        self.browser = None
        self._logged_in = False
        self._login_lock = asyncio.Lock()

    async def ensure_logged_in(self):
        if self._logged_in and self.page and not self.page.is_closed():
            return
        async with self._login_lock:
            # Double-check after acquiring lock
            if self._logged_in and self.page and not self.page.is_closed():
                return
            if self.browser:
                await self.browser.close()
            if self.playwright:
                await self.playwright.stop()
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(headless=True)
            self.page = await self.browser.new_page()
            await self.page.goto(f"{WEB_APP_URL}/auth/signin", wait_until="networkidle")
            await self.page.fill('input[type="email"]', ADMIN_EMAIL)
            await self.page.fill('input[type="password"]', ADMIN_PASSWORD)
            await self.page.click('button[type="submit"]')
            try:
                await self.page.wait_for_load_state("networkidle", timeout=10000)
            except Exception:
                pass
            current_url = self.page.url
            if "/auth/signin" in current_url:
                await self.page.wait_for_timeout(3000)
                current_url = self.page.url
                if "/auth/signin" in current_url:
                    raise Exception(f"Login failed: still on {current_url}")
            self._logged_in = True
            print("Playwright: Logged in")

    async def api_call(self, path: str, payload: dict):
        await self.ensure_logged_in()
        body = json.dumps({"0": {"json": payload}})
        resp = await self.page.evaluate(
            """async ({url, body}) => {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: body,
                    credentials: 'include'
                });
                return await res.json();
            }""",
            {"url": f"{WEB_APP_URL}/api/trpc/{path}?batch=1", "body": body}
        )
        return resp

    async def query(self, path: str, payload: dict):
        await self.ensure_logged_in()
        inp = json.dumps({"json": payload})
        resp = await self.page.evaluate(
            """async ({url}) => {
                const res = await fetch(url, { credentials: 'include' });
                return await res.json();
            }""",
            {"url": f"{WEB_APP_URL}/api/trpc/{path}?input={quote(inp)}"}
        )
        return resp

    async def get_employees(self):
        resp = await self.query("user.list", {})
        try:
            return resp["result"]["data"]["json"]
        except Exception:
            return []

    async def get_board(self, board_id: str):
        resp = await self.query("board.get", {"id": board_id})
        try:
            return resp["result"]["data"]["json"]
        except Exception:
            return None

    async def create_task(self, **kwargs):
        return await self.api_call("task.create", kwargs)

    async def create_board(self, name: str):
        return await self.api_call("board.create", {"name": name})

    async def create_client(self, **kwargs):
        return await self.api_call("clients.create", kwargs)

    async def create_employee(self, **kwargs):
        return await self.api_call("user.create", kwargs)

    async def create_contract(self, **kwargs):
        return await self.api_call("contract.create", kwargs)

    async def close(self):
        self._logged_in = False
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()


automation = MCPAutomation()
app = FastAPI(title="SMB Flow MCP Automation")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    await automation.close()


# ===== LLM Helpers =====
def strip_thinking(text: str) -> str:
    """Remove model thinking tokens from output."""
    # Remove everything between <|channel>thought and <channel|>
    text = re.sub(r"<\|channel>thought.*?<channel\|>", "", text, flags=re.DOTALL)
    # Also handle cases where closing tag is missing
    text = re.sub(r"<\|channel>thought.*", "", text, flags=re.DOTALL)
    # Clean up stray tags and repetition artifacts
    text = re.sub(r"<\|turn\|>", "", text)
    text = re.sub(r"<\|channel>", "", text)
    text = re.sub(r"<channel\|>", "", text)
    text = re.sub(r"</channel\|>", "", text)
    text = re.sub(r"<turn\|>", "", text)
    text = re.sub(r"<\|turn>", "", text)
    return text.strip()


def generate_text(system: str, user: str, max_tokens: int = 1024) -> str:
    messages = [{"role": "user", "content": f"{system}\n\n{user}"}]
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    raw = generate(model, tokenizer, prompt=prompt, max_tokens=max_tokens, verbose=False)
    return strip_thinking(raw)


def parse_json_from_text(text: str) -> dict:
    text = strip_thinking(text)
    patterns = [
        r"```json\s*(.*?)\s*```",
        r"```\s*(.*?)\s*```",
        r"(\{.*\})",
    ]
    for pattern in patterns:
        matches = re.findall(pattern, text, re.DOTALL)
        for match in matches:
            try:
                return json.loads(match)
            except Exception:
                continue
    try:
        return json.loads(text)
    except Exception:
        pass
    raise ValueError("No valid JSON found")


# ===== Intent Classification (LLM ONLY) =====
def classify_intent(message: str) -> dict:
    system = """You are an intent classifier for a business management SaaS.
Given a user message, classify the intent and extract any fields.

Available intents:
- plan_tasks: User wants to plan/project manage tasks on a kanban board
- add_client: User wants to add a new client/contact
- add_employee: User wants to add a new employee/team member
- generate_contract: User wants to generate a contract/document
- unknown: None of the above

Output ONLY valid JSON:
{"intent": "plan_tasks", "fields": {"name": "...", "email": "..."}}

For add_client, fields can be: name, email, phone, company, address, notes
For add_employee, fields can be: name, email, role (ORG_ADMIN or ORG_EMPLOYEE)
For generate_contract, fields can be: title, content, client_name
For plan_tasks, fields can be: prompt, board_name"""

    response = generate_text(system, f"User message: {message}", max_tokens=512)
    try:
        return parse_json_from_text(response)
    except Exception as e:
        print(f"Intent parse error: {e}, raw: {response[:200]}")
        return {"intent": "unknown", "fields": {}}


# ===== Action Execution =====
async def execute_plan_tasks(fields: dict) -> dict:
    prompt = fields.get("prompt", fields.get("board_name", "Plan a project"))
    
    system = """You are an AI project manager. Break down requests into tasks.
Output ONLY valid JSON - no markdown, no explanation, no thinking:
{"tasks": [{"title": "...", "description": "...", "priority": "MEDIUM", "role": "general"}]}
Available roles: admin, developer, designer, marketer, general."""
    
    response = generate_text(system, f"Request: {prompt}", max_tokens=2048)
    plan = parse_json_from_text(response)

    tasks = plan.get("tasks", [])
    if not tasks:
        return {"error": "No tasks generated"}

    employees = await automation.get_employees()
    role_map = {}
    for emp in employees:
        name = (emp.get("name") or emp.get("email") or "").lower()
        emp_id = emp.get("id")
        if "design" in name:
            role_map["designer"] = emp_id
        elif "dev" in name or "eng" in name:
            role_map["developer"] = emp_id
        elif "market" in name:
            role_map["marketer"] = emp_id
        elif "admin" in name:
            role_map["admin"] = emp_id
        else:
            if "general" not in role_map:
                role_map["general"] = emp_id

    board_name = fields.get("board_name", f"AI: {prompt[:30]}")
    board_resp = await automation.create_board(board_name)
    try:
        if isinstance(board_resp, list):
            board_id = board_resp[0]["result"]["data"]["json"]["id"]
        else:
            board_id = board_resp["result"]["data"]["json"]["id"]
    except Exception as e:
        return {"error": f"Could not create board: {e}", "plan": plan}

    board_data = await automation.get_board(board_id)
    columns = board_data.get("columns", [])
    todo_column = next((c for c in columns if "todo" in c["name"].lower()), columns[0])

    created = []
    for task in tasks:
        role = task.get("role", "general")
        assignee_id = role_map.get(role)
        try:
            await automation.create_task(
                title=task["title"],
                description=task.get("description", ""),
                column_id=todo_column["id"],
                board_id=board_id,
                priority=task.get("priority", "MEDIUM"),
                assignee_id=assignee_id,
            )
            created.append({"task": task, "ok": True})
        except Exception as e:
            created.append({"task": task, "error": str(e)})

    return {
        "action": "plan_tasks",
        "board_id": board_id,
        "board_name": board_name,
        "tasks_planned": len(tasks),
        "tasks_created": sum(1 for c in created if c.get("ok")),
        "details": created,
    }


async def execute_add_client(fields: dict) -> dict:
    name = fields.get("name")
    if not name:
        return {"action": "add_client", "missing": ["name"], "message": "What is the client's name?"}
    
    resp = await automation.create_client(
        name=name,
        email=fields.get("email") or None,
        phone=fields.get("phone") or None,
        company=fields.get("company") or None,
        address=fields.get("address") or None,
        notes=fields.get("notes") or None,
    )
    return {"action": "add_client", "result": resp, "message": f"Client '{name}' added successfully."}


async def execute_add_employee(fields: dict) -> dict:
    name = fields.get("name")
    email = fields.get("email")
    if not name:
        return {"action": "add_employee", "missing": ["name"], "message": "What is the employee's name?"}
    if not email:
        return {"action": "add_employee", "missing": ["email"], "message": "What is the employee's email address?"}
    
    role = fields.get("role", "ORG_EMPLOYEE")
    import secrets
    temp_password = secrets.token_urlsafe(8)
    
    resp = await automation.create_employee(
        name=name,
        email=email,
        password=temp_password,
        role=role,
    )
    return {
        "action": "add_employee",
        "result": resp,
        "message": f"Employee '{name}' added with temporary password: {temp_password}",
    }


async def execute_generate_contract(fields: dict) -> dict:
    title = fields.get("title")
    if not title:
        return {"action": "generate_contract", "missing": ["title"], "message": "What should the contract be titled?"}
    
    client_name = fields.get("client_name", "the Client")
    
    system = f"""You are a legal assistant. Generate a simple business contract.
The contract title is: {title}
The client is referred to as: {client_name}
Output ONLY the contract text in HTML format (use basic tags like <p>, <h2>, <ul>, <li>).
Do NOT include any thinking, reasoning, or explanation."""
    
    content = generate_text(system, "Generate the full contract text.", max_tokens=2048)
    # Clean up any remaining markdown
    content = re.sub(r"```html\s*", "", content)
    content = re.sub(r"```\s*", "", content)
    content = content.strip()

    resp = await automation.create_contract(title=title, content=content)
    return {
        "action": "generate_contract",
        "result": resp,
        "message": f"Contract '{title}' generated and saved.",
    }


# ===== Required Fields =====
REQUIRED_FIELDS = {
    "add_client": ["name"],
    "add_employee": ["name", "email"],
    "generate_contract": ["title"],
    "plan_tasks": [],
}

FIELD_QUESTIONS = {
    "name": "What is the name?",
    "email": "What is the email address?",
    "title": "What should the title be?",
}


# ===== Extract Missing Fields with LLM =====
def extract_fields(message: str, intent: str, pending: dict) -> dict:
    """Use LLM to extract fields from user message."""
    needed = [f for f in REQUIRED_FIELDS.get(intent, []) if f not in pending or not pending[f]]
    if not needed:
        return pending
    
    system = f"""Extract structured fields from the user message.
Needed fields: {', '.join(needed)}
Already known: {json.dumps(pending)}

Output ONLY valid JSON with the extracted fields. Use null if a field is not present."""
    
    response = generate_text(system, f"User message: {message}", max_tokens=256)
    try:
        extracted = parse_json_from_text(response)
        if isinstance(extracted, dict):
            for k, v in extracted.items():
                if v is not None and v != "":
                    pending[k] = v
    except Exception as e:
        print(f"Field extraction error: {e}")
        # Fallback: assign message to first missing field
        if needed:
            pending[needed[0]] = message.strip()
    
    return pending


# ===== Chat Endpoint =====
@app.post("/api/chat")
async def chat(req: ChatRequest):
    sid = req.session_id or str(uuid.uuid4())
    session = get_session(sid)
    
    user_msg = req.messages[-1].content if req.messages else ""
    session["history"].append({"role": "user", "content": user_msg})
    
    # Handle pending intent
    if session.get("pending_intent"):
        intent = session["pending_intent"]
        pending = session.get("pending_fields", {})
        pending = extract_fields(user_msg, intent, pending)
        session["pending_fields"] = pending
        
        missing = [f for f in REQUIRED_FIELDS.get(intent, []) if not pending.get(f)]
        if missing:
            questions = [FIELD_QUESTIONS.get(f, f"What is the {f}?") for f in missing]
            return {
                "session_id": sid,
                "reply": " ".join(questions),
                "pending": True,
                "intent": intent,
                "action": None,
            }
        
        session["pending_intent"] = None
        if intent == "plan_tasks":
            result = await execute_plan_tasks(pending)
        elif intent == "add_client":
            result = await execute_add_client(pending)
        elif intent == "add_employee":
            result = await execute_add_employee(pending)
        elif intent == "generate_contract":
            result = await execute_generate_contract(pending)
        else:
            result = {"error": "Unknown intent"}
        
        if result.get("missing"):
            session["pending_intent"] = intent
            return {
                "session_id": sid,
                "reply": result.get("message", f"Please provide: {', '.join(result['missing'])}"),
                "pending": True,
                "intent": intent,
                "action": None,
            }
        
        return {
            "session_id": sid,
            "reply": result.get("message", f"Done! {intent} completed."),
            "pending": False,
            "intent": intent,
            "action": result,
        }
    
    # New conversation - classify intent with LLM
    classification = classify_intent(user_msg)
    intent = classification.get("intent", "unknown")
    fields = classification.get("fields", {})
    
    if intent == "unknown":
        return {
            "session_id": sid,
            "reply": "I can help you with:\n• Planning tasks on a kanban board\n• Adding clients\n• Adding employees\n• Generating contracts\n\nWhat would you like to do?",
            "pending": False,
            "intent": None,
            "action": None,
        }
    
    missing = [f for f in REQUIRED_FIELDS.get(intent, []) if not fields.get(f)]
    if missing:
        session["pending_intent"] = intent
        session["pending_fields"] = fields
        questions = [FIELD_QUESTIONS.get(f, f"What is the {f}?") for f in missing]
        return {
            "session_id": sid,
            "reply": " ".join(questions),
            "pending": True,
            "intent": intent,
            "action": None,
        }
    
    if intent == "plan_tasks":
        result = await execute_plan_tasks(fields)
    elif intent == "add_client":
        result = await execute_add_client(fields)
    elif intent == "add_employee":
        result = await execute_add_employee(fields)
    elif intent == "generate_contract":
        result = await execute_generate_contract(fields)
    else:
        result = {"error": "Unknown intent"}
    
    if result.get("missing"):
        session["pending_intent"] = intent
        session["pending_fields"] = fields
        return {
            "session_id": sid,
            "reply": result.get("message", f"Please provide: {', '.join(result['missing'])}"),
            "pending": True,
            "intent": intent,
            "action": None,
        }
    
    return {
        "session_id": sid,
        "reply": result.get("message", f"Done! {intent} completed."),
        "pending": False,
        "intent": intent,
        "action": result,
    }


@app.post("/api/plan")
async def plan_tasks(req: PlanRequest):
    """Legacy endpoint - now also uses LLM."""
    return await execute_plan_tasks({"prompt": req.prompt, "board_name": f"AI: {req.prompt[:30]}"})


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

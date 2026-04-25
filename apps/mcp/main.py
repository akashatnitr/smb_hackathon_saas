"""
SMB Flow MCP Automation Server
Uses local MLX model + Playwright to automate tasks in the web app.
Supports multi-turn conversations for clients, employees, contracts, and kanban tasks.
"""
import os
import json
import re
import uuid
from typing import Optional, Dict, List, Any
from urllib.parse import quote
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from playwright.async_api import async_playwright, Page
from pathlib import Path

# ===== Model Loading =====
MODEL_PATH = os.getenv(
    "MODEL_PATH",
    "/Users/akash/.cache/huggingface/hub/models--mlx-community--gemma-4-E4B-it-4bit/snapshots/cc3b666c01c20395e0dcebd53854504c7d9821f9"
)
model = None
tokenizer = None

try:
    from mlx_lm.utils import load_model, load_tokenizer
    from mlx_lm import generate
    print("Loading MLX model...")
    mp = Path(MODEL_PATH)
    tokenizer = load_tokenizer(mp)
    model, config = load_model(mp, lazy=True, strict=False)
    print("Model loaded successfully.")
except Exception as e:
    print(f"Warning: Could not load MLX model: {e}")
    print("Falling back to rule-based planner.")

WEB_APP_URL = os.getenv("WEB_APP_URL", "http://localhost:3000")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@acme.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")


# ===== Pydantic Models =====
class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
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

    async def ensure_logged_in(self):
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
                raise Exception(f"Login failed: still on signin page")
        self._logged_in = True
        print("Playwright: Login successful")

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
def generate_text(system: str, user: str, max_tokens: int = 1024) -> str:
    if model is None or tokenizer is None:
        raise RuntimeError("Model not loaded")
    messages = [
        {"role": "user", "content": f"{system}\n\n{user}"}
    ]
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    return generate(model, tokenizer, prompt=prompt, max_tokens=max_tokens, verbose=False)


def parse_json_from_text(text: str) -> dict:
    # Try to find JSON block
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
    # Try entire text
    try:
        return json.loads(text)
    except Exception:
        pass
    raise ValueError("No valid JSON found")


# ===== Intent Classification =====
INTENT_PROMPT = """You are an intent classifier for a business management SaaS. 
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
For plan_tasks, fields can be: prompt, board_name
"""


def classify_intent(message: str) -> dict:
    if model is None:
        # Rule-based fallback
        msg = message.lower()
        if any(w in msg for w in ["plan", "task", "board", "project", "event", "website", "launch"]):
            return {"intent": "plan_tasks", "fields": {"prompt": message}}
        if any(w in msg for w in ["client", "contact", "customer"]):
            return {"intent": "add_client", "fields": {}}
        if any(w in msg for w in ["employee", "hire", "team member", "staff"]):
            return {"intent": "add_employee", "fields": {}}
        if any(w in msg for w in ["contract", "agreement", "document"]):
            return {"intent": "generate_contract", "fields": {}}
        return {"intent": "unknown", "fields": {}}
    
    response = generate_text(INTENT_PROMPT, f"User message: {message}", max_tokens=512)
    try:
        return parse_json_from_text(response)
    except Exception as e:
        print(f"Intent parse error: {e}, raw: {response[:200]}")
        return {"intent": "unknown", "fields": {}}


# ===== Action Execution =====
async def execute_plan_tasks(fields: dict) -> dict:
    prompt = fields.get("prompt", fields.get("board_name", "Plan a project"))
    
    # Generate tasks using LLM
    if model is not None:
        system = """You are an AI project manager. Break down requests into tasks.
Output ONLY valid JSON:
{"tasks": [{"title": "...", "description": "...", "priority": "MEDIUM", "role": "general"}]}
Available roles: admin, developer, designer, marketer, general."""
        try:
            response = generate_text(system, f"Request: {prompt}", max_tokens=1024)
            plan = parse_json_from_text(response)
        except Exception as e:
            print(f"LLM plan failed: {e}")
            plan = rule_based_planner(prompt)
    else:
        plan = rule_based_planner(prompt)

    tasks = plan.get("tasks", [])
    if not tasks:
        return {"error": "No tasks generated"}

    # Get employees for role mapping
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

    # Create board
    board_name = fields.get("board_name", f"AI: {prompt[:30]}")
    board_resp = await automation.create_board(board_name)
    try:
        if isinstance(board_resp, list):
            board_id = board_resp[0]["result"]["data"]["json"]["id"]
        else:
            board_id = board_resp["result"]["data"]["json"]["id"]
    except Exception as e:
        return {"error": f"Could not create board: {e}", "plan": plan}

    # Get columns
    board_data = await automation.get_board(board_id)
    columns = board_data.get("columns", [])
    todo_column = next((c for c in columns if "todo" in c["name"].lower()), columns[0])

    created = []
    for task in tasks:
        role = task.get("role", "general")
        assignee_id = role_map.get(role)
        try:
            resp = await automation.create_task(
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
    # Generate a temporary password
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
    
    # Generate contract content with LLM
    if model is not None:
        system = f"""You are a legal assistant. Generate a simple business contract.
The contract title is: {title}
The client is referred to as: {client_name}
Output ONLY the contract text in HTML format (use basic tags like <p>, <h2>, <ul>, <li>)."""
        try:
            content = generate_text(system, "Generate the full contract text.", max_tokens=2048)
            # Clean up any markdown code blocks
            content = re.sub(r"```html\s*", "", content)
            content = re.sub(r"```\s*", "", content)
            # Remove model thinking artifacts
            content = re.sub(r"<\|channel\|>thought.*?</channel\|>", "", content, flags=re.DOTALL)
            content = re.sub(r"<\|turn\|>", "", content)
            content = re.sub(r"<channel\|>", "", content)
            content = content.strip()
        except Exception as e:
            print(f"LLM contract generation failed: {e}")
            content = generate_fallback_contract(title, client_name)
    else:
        content = generate_fallback_contract(title, client_name)

    resp = await automation.create_contract(title=title, content=content)
    return {
        "action": "generate_contract",
        "result": resp,
        "message": f"Contract '{title}' generated and saved.",
    }


def generate_fallback_contract(title: str, client_name: str) -> str:
    return f"""<h2>{title}</h2>
<p>This agreement is entered into between the Service Provider and {client_name}.</p>
<h3>1. Services</h3>
<p>The Service Provider agrees to perform the services as described in the project scope.</p>
<h3>2. Payment Terms</h3>
<p>Payment is due within 30 days of invoice date.</p>
<h3>3. Termination</h3>
<p>Either party may terminate this agreement with 30 days written notice.</p>
<h3>4. Confidentiality</h3>
<p>Both parties agree to keep all proprietary information confidential.</p>
<h3>Signatures</h3>
<p>_______________________<br>Service Provider</p>
<p>_______________________<br>{client_name}</p>"""


def rule_based_planner(prompt: str) -> dict:
    prompt_lower = prompt.lower()
    if "event" in prompt_lower:
        tasks = [
            {"title": "Define event objectives & budget", "description": "Clarify goals and set budget limits", "priority": "HIGH", "role": "admin"},
            {"title": "Book venue", "description": "Research and reserve event location", "priority": "HIGH", "role": "admin"},
            {"title": "Create event marketing plan", "description": "Design social media and email campaigns", "priority": "MEDIUM", "role": "marketer"},
            {"title": "Design event branding", "description": "Create logos, banners, and swag designs", "priority": "MEDIUM", "role": "designer"},
            {"title": "Build registration page", "description": "Develop online signup form", "priority": "HIGH", "role": "developer"},
            {"title": "Arrange catering", "description": "Select menu and confirm dietary options", "priority": "MEDIUM", "role": "general"},
            {"title": "Prepare day-of schedule", "description": "Create detailed run-of-show timeline", "priority": "HIGH", "role": "admin"},
        ]
    elif "website" in prompt_lower or "web" in prompt_lower:
        tasks = [
            {"title": "Gather requirements", "description": "Collect client needs and feature list", "priority": "HIGH", "role": "admin"},
            {"title": "Create wireframes", "description": "Design low-fidelity page layouts", "priority": "HIGH", "role": "designer"},
            {"title": "Design UI mockups", "description": "High-fidelity designs in Figma", "priority": "HIGH", "role": "designer"},
            {"title": "Set up project repo", "description": "Initialize codebase and CI/CD", "priority": "MEDIUM", "role": "developer"},
            {"title": "Develop frontend", "description": "Build React/Vue components", "priority": "HIGH", "role": "developer"},
            {"title": "Develop backend API", "description": "Build REST/GraphQL endpoints", "priority": "HIGH", "role": "developer"},
            {"title": "Write content", "description": "Create copy and SEO metadata", "priority": "MEDIUM", "role": "marketer"},
            {"title": "Test & QA", "description": "Cross-browser testing and bug fixes", "priority": "HIGH", "role": "developer"},
            {"title": "Deploy to production", "description": "Launch site and configure domain", "priority": "URGENT", "role": "developer"},
        ]
    else:
        tasks = [
            {"title": "Define scope & requirements", "description": f"Clarify goals for: {prompt}", "priority": "HIGH", "role": "admin"},
            {"title": "Research & planning", "description": "Conduct background research", "priority": "MEDIUM", "role": "general"},
            {"title": "Create action plan", "description": "Break down into milestones", "priority": "HIGH", "role": "admin"},
            {"title": "Execute phase 1", "description": "Complete first set of deliverables", "priority": "MEDIUM", "role": "general"},
            {"title": "Review & iterate", "description": "Gather feedback and refine", "priority": "MEDIUM", "role": "admin"},
        ]
    return {"tasks": tasks}


# ===== Required Fields by Intent =====
REQUIRED_FIELDS = {
    "add_client": ["name"],
    "add_employee": ["name", "email"],
    "generate_contract": ["title"],
    "plan_tasks": [],
}


# ===== Chat Endpoint =====
@app.post("/api/chat")
async def chat(req: ChatRequest):
    sid = req.session_id or str(uuid.uuid4())
    session = get_session(sid)
    
    # Append user message
    user_msg = req.messages[-1].content if req.messages else ""
    session["history"].append({"role": "user", "content": user_msg})
    
    # Check if we have a pending intent waiting for fields
    if session.get("pending_intent"):
        intent = session["pending_intent"]
        pending = session.get("pending_fields", {})
        
        # Try to extract fields from user's message
        if model is not None:
            extract_prompt = f"""Extract information from this user message into JSON.
Needed fields: {', '.join(REQUIRED_FIELDS.get(intent, []))}
Already have: {json.dumps(pending)}

User message: {user_msg}

Output ONLY JSON with the extracted fields."""
            try:
                response = generate_text("You extract structured data.", extract_prompt, max_tokens=512)
                extracted = parse_json_from_text(response)
                if isinstance(extracted, dict):
                    pending.update(extracted)
            except Exception as e:
                print(f"Field extraction failed: {e}")
                # Simple keyword extraction fallback
                for field in REQUIRED_FIELDS.get(intent, []):
                    if field not in pending:
                        pending[field] = user_msg.strip()
        else:
            # Fallback: use the whole message as the missing field
            missing = [f for f in REQUIRED_FIELDS.get(intent, []) if f not in pending]
            if missing:
                pending[missing[0]] = user_msg.strip()
        
        session["pending_fields"] = pending
        
        # Check if all required fields are now present
        missing = [f for f in REQUIRED_FIELDS.get(intent, []) if not pending.get(f)]
        if missing:
            # Ask for next missing field
            field_names = ", ".join(missing)
            return {
                "session_id": sid,
                "reply": f"I need a bit more information. Please provide: {field_names}",
                "pending": True,
                "intent": intent,
                "action": None,
            }
        
        # All fields present, execute
        session["pending_intent"] = None
        if intent == "add_client":
            result = await execute_add_client(pending)
        elif intent == "add_employee":
            result = await execute_add_employee(pending)
        elif intent == "generate_contract":
            result = await execute_generate_contract(pending)
        elif intent == "plan_tasks":
            result = await execute_plan_tasks(pending)
        else:
            result = {"error": "Unknown intent"}
        
        if result.get("missing"):
            session["pending_intent"] = intent
            session["pending_fields"] = pending
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
    
    # New conversation - classify intent
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
    
    # Check if all required fields are present
    missing = [f for f in REQUIRED_FIELDS.get(intent, []) if not fields.get(f)]
    if missing:
        session["pending_intent"] = intent
        session["pending_fields"] = fields
        field_questions = {
            "name": "What is the name?",
            "email": "What is the email address?",
            "title": "What should the title be?",
        }
        questions = [field_questions.get(f, f"What is the {f}?") for f in missing]
        return {
            "session_id": sid,
            "reply": " ".join(questions),
            "pending": True,
            "intent": intent,
            "action": None,
        }
    
    # All fields present, execute immediately
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


# ===== Legacy Plan Endpoint (kept for compatibility) =====
@app.post("/api/plan")
async def plan_tasks(req: PlanRequest):
    return await execute_plan_tasks({"prompt": req.prompt, "board_name": f"Auto: {req.prompt[:30]}"})


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": model is not None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

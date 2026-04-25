"""
SMB Flow MCP Automation Server
Uses local MLX model + Playwright to automate tasks in the web app.
"""
import os
import json
import re
from typing import Optional
from urllib.parse import quote
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from pydantic import BaseModel
from playwright.async_api import async_playwright, Page

# Try to load MLX model
MODEL_PATH = os.getenv("MODEL_PATH", "/Users/akash/.cache/huggingface/hub/models--mlx-community--gemma-4-E4B-it-4bit/snapshots/cc3b666c01c20395e0dcebd53854504c7d9821f9")
model = None
tokenizer = None

try:
    from mlx_lm import load, generate
    print("Loading MLX model...")
    model, tokenizer = load(MODEL_PATH)
    print("Model loaded successfully.")
except Exception as e:
    print(f"Warning: Could not load MLX model: {e}")
    print("Falling back to rule-based planner.")

WEB_APP_URL = os.getenv("WEB_APP_URL", "http://localhost:3000")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@acme.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")


class PlanRequest(BaseModel):
    prompt: str
    board_id: Optional[str] = None


class MCPAutomation:
    def __init__(self):
        self.page: Optional[Page] = None
        self.playwright = None
        self.browser = None

    async def ensure_logged_in(self):
        if self.page is None:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(headless=True)
            self.page = await self.browser.new_page()
            await self.page.goto(f"{WEB_APP_URL}/auth/signin")
            await self.page.fill('input[type="email"]', ADMIN_EMAIL)
            await self.page.fill('input[type="password"]', ADMIN_PASSWORD)
            await self.page.click('button[type="submit"]')
            await self.page.wait_for_url("**/dashboard")
            print("Playwright: logged in")

    async def api_call(self, path: str, payload: dict):
        await self.ensure_logged_in()
        body = json.dumps({"0": {"json": payload}})
        resp = await self.page.evaluate(
            """async ({url, body}) => {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: body
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
                const res = await fetch(url);
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

    async def create_task(self, title: str, description: str, column_id: str, board_id: str,
                          priority: str = "MEDIUM", assignee_id: Optional[str] = None):
        return await self.api_call("task.create", {
            "title": title,
            "description": description,
            "priority": priority,
            "columnId": column_id,
            "boardId": board_id,
            "assigneeId": assignee_id,
        })

    async def create_board(self, name: str):
        return await self.api_call("board.create", {"name": name})

    async def close(self):
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()


automation = MCPAutomation()
app = FastAPI(title="SMB Flow MCP Automation")


@app.on_event("shutdown")
async def shutdown():
    await automation.close()


def rule_based_planner(prompt: str) -> dict:
    """Fallback planner when LLM is not available."""
    prompt_lower = prompt.lower()
    tasks = []

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
    elif "launch" in prompt_lower or "product" in prompt_lower:
        tasks = [
            {"title": "Market research", "description": "Analyze competitors and target audience", "priority": "HIGH", "role": "marketer"},
            {"title": "Define MVP scope", "description": "Prioritize features for launch", "priority": "HIGH", "role": "admin"},
            {"title": "Create landing page", "description": "Design and build marketing site", "priority": "HIGH", "role": "designer"},
            {"title": "Set up analytics", "description": "Configure tracking and dashboards", "priority": "MEDIUM", "role": "developer"},
            {"title": "Prepare press kit", "description": "Write press release and gather assets", "priority": "MEDIUM", "role": "marketer"},
            {"title": "Beta testing", "description": "Recruit testers and collect feedback", "priority": "HIGH", "role": "general"},
            {"title": "Launch day coordination", "description": "Execute launch checklist", "priority": "URGENT", "role": "admin"},
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


def run_llm(prompt: str) -> str:
    if model is None or tokenizer is None:
        raise RuntimeError("Model not loaded")
    from mlx_lm import generate
    system = """You are an AI project manager assistant. Break down requests into tasks.
Output ONLY valid JSON in this format:
{"tasks": [{"title": "...", "description": "...", "priority": "MEDIUM", "role": "general"}]}
Roles: admin, developer, designer, marketer, general."""
    full_prompt = f"{system}\n\nRequest: {prompt}\n\nJSON:"
    print(f"Generating plan for: {prompt}")
    return generate(model, tokenizer, prompt=full_prompt, max_tokens=2048, verbose=False)


def parse_llm_response(response: str) -> dict:
    try:
        start = response.find("{")
        end = response.rfind("}") + 1
        if start == -1 or end == 0:
            raise ValueError("No JSON found")
        return json.loads(response[start:end])
    except Exception as e:
        raise ValueError(f"Failed to parse LLM output: {e}")


@app.post("/api/plan")
async def plan_tasks(req: PlanRequest):
    """Natural language planning endpoint."""
    # Try LLM first, fallback to rule-based
    if model is not None and tokenizer is not None:
        try:
            response = run_llm(req.prompt)
            plan = parse_llm_response(response)
        except Exception as e:
            print(f"LLM failed: {e}, using fallback")
            plan = rule_based_planner(req.prompt)
    else:
        plan = rule_based_planner(req.prompt)

    tasks = plan.get("tasks", [])
    if not tasks:
        return {"error": "No tasks generated", "plan": plan}

    # Get employees to match roles
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

    # Get or create board
    board_id = req.board_id
    if not board_id:
        board_resp = await automation.create_board(f"Auto: {req.prompt[:30]}")
        try:
            # Batch responses are arrays
            if isinstance(board_resp, list):
                board_id = board_resp[0]["result"]["data"]["json"]["id"]
            else:
                board_id = board_resp["result"]["data"]["json"]["id"]
        except Exception as e:
            return {"error": f"Could not create board: {str(e)}", "plan": plan}

    # Fetch board columns
    board_data = await automation.get_board(board_id)
    if not board_data:
        return {"error": "Could not fetch board", "plan": plan}

    columns = board_data.get("columns", [])
    if not columns:
        return {"error": "Board has no columns", "plan": plan}

    todo_column = next((c for c in columns if "todo" in c["name"].lower()), columns[0])

    created_tasks = []
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
            created_tasks.append({"task": task, "response": resp})
        except Exception as e:
            created_tasks.append({"task": task, "error": str(e)})

    return {
        "board_id": board_id,
        "tasks_planned": len(tasks),
        "tasks_created": len(created_tasks),
        "details": created_tasks,
    }


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": model is not None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

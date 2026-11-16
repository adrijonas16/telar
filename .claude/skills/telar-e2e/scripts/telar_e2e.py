"""End-to-end test of Ask Telar with a scripted model (no AI key).

Usage: python telar_e2e.py [URL]   (default http://localhost:4173)
"""
import asyncio
import json
import os
import pathlib
import sys

from playwright.async_api import async_playwright

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from scripted import HEADERS, text, tool_call  # noqa: E402

URL = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173").rstrip("/")
BUILD = {
    "name": "cafe_andino",
    "description": "Answers questions about Café Andino's coffee and books tables.",
    "siteName": "Café Andino",
    "sampleQueries": ["Do you have oat milk?", "Book a table for 4 on Friday at 8 pm."],
    "entryPoint": "cafe_host",
    "agents": [
        {"name": "cafe_host", "description": "Greets guests and routes requests.",
         "instructions": "Send menu questions to menu_guide. Never invent prices.", "calls": ["menu_guide"]},
        {"name": "menu_guide", "description": "Explains drinks, food and allergens.",
         "instructions": "Answer only from the menu the site provides."},
    ],
}


async def model(route):
    msgs = json.loads(route.request.post_data or "{}").get("messages", [])
    if any(m.get("role") == "tool" for m in msgs):
        body = text("Done: I built cafe_andino. Use Undo to go back.")
    elif any("Café Andino" in str(m.get("content")) for m in msgs if m.get("role") == "user"):
        body = tool_call("website_build_network", BUILD)
    else:
        body = text("Hi")  # the runtime's own check calls
    await route.fulfill(status=200, headers=HEADERS, body=body)


async def main() -> int:
    problems: list[str] = []
    async with async_playwright() as p:
        chrome = os.environ.get("CHROME")
        browser = await p.chromium.launch(**({"executable_path": chrome, "args": ["--no-sandbox"]} if chrome else {}))
        ctx = await browser.new_context(viewport={"width": 1440, "height": 900})
        await ctx.add_init_script("try{localStorage.setItem('telar.welcomed.v1','1')}catch(e){}")
        pg = await ctx.new_page()
        pg.on("pageerror", lambda e: problems.append(f"page error: {e}"))
        await ctx.route("https://api.otari.ai/**", model)
        await pg.goto(URL + "/")
        await pg.wait_for_timeout(1200)
        before = await pg.locator("telar-canvas g.node").count()
        ask = pg.locator("telar-toolbar").get_by_role("button", name="Ask Telar")
        await ask.click()
        await pg.wait_for_timeout(2500)
        await pg.fill("#ns-key", "fake_key_for_tests")
        await pg.click("#ns-apply")
        await pg.wait_for_timeout(1500)
        if await pg.locator("#assistant").is_hidden():
            await ask.click()
            await pg.wait_for_timeout(2500)
        await pg.fill("#ns-input", "Create a network for Café Andino, a coffee shop.")
        await pg.click("#ns-send")
        await pg.wait_for_timeout(5000)
        nodes = await pg.locator("telar-canvas g.node").count()
        steps = await pg.locator("telar-toolbar .steps").inner_text()
        if nodes != 2:
            problems.append(f"expected 2 cards after build_network, found {nodes}")
        if "All checks pass" not in steps:
            problems.append(f"checks do not pass: {steps!r}")
        await pg.click("[data-close-assistant]")
        await pg.locator("telar-toolbar").get_by_role("button", name="Undo").click()
        await pg.wait_for_timeout(500)
        if await pg.locator("telar-canvas g.node").count() != before:
            problems.append("Undo did not restore the previous network")
        await browser.close()
    if problems:
        print("FAILED:", *problems, sep="\n  ")
        return 1
    print("OK: Ask Telar built a conforming network through website_build_network, and Undo restored the canvas.")
    return 0


sys.exit(asyncio.run(main()))

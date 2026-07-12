"""Capture BeeAR try-on demo screenshots (headless Chrome + Selenium)."""

from __future__ import annotations

import json
import time
import urllib.request
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

BASE = "http://127.0.0.1:8860"
OUT = Path(__file__).resolve().parents[1] / "docs" / "screenshots"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


def wait_health(timeout: float = 30.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(BASE + "/health", timeout=2) as r:
                data = json.loads(r.read().decode())
                if data.get("ok"):
                    print("health", data)
                    return
        except Exception:
            time.sleep(0.4)
    raise RuntimeError("BeeAR server not up on 8860")


def click_sku(driver, name_substr: str) -> None:
    for el in driver.find_elements(By.CSS_SELECTOR, ".sku"):
        if name_substr.lower() in el.text.lower():
            el.click()
            time.sleep(0.6)
            return
    raise RuntimeError(f"SKU not found: {name_substr}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    wait_health()

    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1400,900")
    opts.add_argument("--force-device-scale-factor=1")
    opts.add_argument("--hide-scrollbars")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--use-fake-ui-for-media-stream")
    opts.add_argument("--use-fake-device-for-media-stream")
    opts.binary_location = CHROME

    driver = webdriver.Chrome(options=opts)
    wait = WebDriverWait(driver, 25)
    try:
        driver.get(BASE + "/")
        wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, ".sku"))
        # ensure demo photo mode
        try:
            cons = driver.find_element(By.ID, "consent")
            if "hidden" not in (cons.get_attribute("class") or ""):
                driver.find_element(By.ID, "consent-demo").click()
        except Exception:
            pass
        try:
            driver.find_element(By.ID, "btn-demo").click()
        except Exception:
            pass
        time.sleep(2.0)

        # 1) Overview with aviator on photoreal face
        click_sku(driver, "Aviator")
        time.sleep(1.0)
        driver.save_screenshot(str(OUT / "demo-aviator.png"))
        print("saved demo-aviator.png")

        # 2) Wayfarer
        click_sku(driver, "Wayfarer")
        time.sleep(0.7)
        driver.save_screenshot(str(OUT / "demo-wayfarer.png"))
        print("saved demo-wayfarer.png")

        # 3) Cat-eye
        click_sku(driver, "Cat-Eye")
        time.sleep(0.7)
        driver.save_screenshot(str(OUT / "demo-cateye.png"))
        print("saved demo-cateye.png")

        # 4) Sport + PD adjust
        click_sku(driver, "Sport")
        driver.execute_script(
            """
            const el = document.getElementById('pd');
            el.value = 70;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            """
        )
        time.sleep(0.7)
        driver.save_screenshot(str(OUT / "demo-sport-pd70.png"))
        print("saved demo-sport-pd70.png")

        # 5) Compare mode
        driver.find_element(By.ID, "btn-compare").click()
        time.sleep(0.4)
        click_sku(driver, "Aviator")
        time.sleep(0.3)
        click_sku(driver, "Wayfarer")
        time.sleep(0.8)
        driver.save_screenshot(str(OUT / "demo-compare.png"))
        print("saved demo-compare.png")

        # 6) Second photoreal face + wayfarer
        try:
            driver.find_element(By.ID, "btn-demo-next").click()
            time.sleep(0.5)
            # reset filter to all
            sel = driver.find_element(By.ID, "filter")
            for opt in sel.find_elements(By.TAG_NAME, "option"):
                if opt.get_attribute("value") == "":
                    opt.click()
                    break
            time.sleep(0.5)
            click_sku(driver, "Wayfarer")
            time.sleep(0.8)
            driver.save_screenshot(str(OUT / "demo-face-b.png"))
            print("saved demo-face-b.png")
        except Exception as e:
            print("face-b skip:", e)

        # 7) Accessories filter + earring
        sel = driver.find_element(By.ID, "filter")
        for opt in sel.find_elements(By.TAG_NAME, "option"):
            if opt.get_attribute("value") == "accessory":
                opt.click()
                break
        time.sleep(0.8)
        try:
            click_sku(driver, "Hoop")
        except Exception:
            click_sku(driver, "Cap")
        time.sleep(0.7)
        driver.save_screenshot(str(OUT / "demo-accessory.png"))
        print("saved demo-accessory.png")

        # 8) Vietnamese UI
        driver.find_element(By.ID, "btn-lang").click()
        time.sleep(0.5)
        driver.save_screenshot(str(OUT / "demo-vi-ui.png"))
        print("saved demo-vi-ui.png")

    finally:
        driver.quit()

    for p in sorted(OUT.glob("*.png")):
        print(f"  {p.name} {p.stat().st_size} bytes")


if __name__ == "__main__":
    main()

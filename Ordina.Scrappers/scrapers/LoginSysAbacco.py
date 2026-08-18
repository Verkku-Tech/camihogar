from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
import time


def login_abacco(headless: bool = False):
    options = Options()
    options.add_argument("--log-level=3")
    options.add_argument("--disable-background-networking")
    if headless:
        options.add_argument("--headless=new")
        options.add_argument("--window-size=1920,1080")
    options.add_experimental_option("excludeSwitches", ["enable-logging"])
    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(180)
    driver.set_script_timeout(60)
    # Paso 1: Ir a la página de inicio
    driver.get("https://sys.abacco.com/login.php")
    # Esperar carga inicial
    time.sleep(3)

    # Paso 2: Completar login
    cod_access = "home"
    # Esperar carga inicial
    time.sleep(3)
    # Busca campos por ID o NAME
    driver.find_element(By.NAME, "usea").send_keys(cod_access)
    driver.find_element(By.NAME, "usea").send_keys(Keys.ENTER)
    # Esperar carga inicial
    time.sleep(3)

    # Paso 3: Completar login
    usuario = "ramonverkku"
    clave = "3dykbpxz"
    # Busca campos por ID o NAME
    driver.find_element(By.NAME, "username").send_keys(usuario)
    driver.find_element(By.NAME, "password").send_keys(clave)
    driver.find_element(By.NAME, "password").send_keys(Keys.ENTER)
    # Esperar a que se cargue el dashboard
    time.sleep(5)

    print("Login completado")
    return driver

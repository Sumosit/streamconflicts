from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    app_name: str = "StreamArchive API"
    database_url: str = "sqlite:////data/streamarchive.sqlite3"
    upload_dir: Path = Path("/uploads")
    public_upload_url: str = "http://localhost:8000/uploads"
    cors_origins: str = "http://localhost:4200"
    site_lang: str = "ru"
    site_name: str = "Стримархив"
    site_base_url: str = "https://streamconflicts.com"
    site_description: str = "Нейтральный архив конфликтов стримеров: факты, хронология и первоисточники."
    site_path_prefix: str = ""
    # Путь соседней языковой версии на том же домене, например "en".
    # Указывается только у экземпляра, отдающего robots.txt в корне домена:
    # robots.txt читается поисковиками лишь из корня, поэтому корневой файл
    # должен объявлять sitemap соседней версии и закрывать её редактор.
    alt_site_path_prefix: str = ""
    jwt_secret: str
    jwt_expire_minutes: int = 480
    bootstrap_admin_email: str
    bootstrap_admin_password: str
    max_image_size_mb: int = 8

    model_config = SettingsConfigDict(case_sensitive=False)

    @property
    def site_path(self) -> str:
        """Путь сайта внутри домена: пустая строка для корня, /en для англоязычной версии."""
        prefix = self.site_path_prefix.strip("/")
        return f"/{prefix}" if prefix else ""

    @property
    def alt_site_path(self) -> str:
        """Путь соседней языковой версии: пустая строка, если её нет."""
        prefix = self.alt_site_path_prefix.strip("/")
        return f"/{prefix}" if prefix else ""

    @property
    def site_root(self) -> str:
        """Полный адрес корня сайта, например https://streamconflicts.com/en."""
        return self.site_base_url.rstrip("/") + self.site_path

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

"""Изображения истории: загрузка по ссылке, подтверждение, удаление.

Ссылки на картинки приходят из исследовательской выдачи и почти всегда
ненадёжны: часть ведёт на несуществующие страницы, часть — на HTML вместо
файла. Поэтому скачивание отдельное и ручное: редактор смотрит на кандидата,
нажимает «Скачать», и только тогда сервер идёт наружу.
"""

import ipaddress
import socket
from io import BytesIO
from urllib.parse import urlparse
from urllib.request import Request as UrlRequest, urlopen
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.database import get_db
from app.models import HistoryEvent, HistoryImage, HistoryImageTranslation, User
from app.schemas import HistoryImageAdminOut, HistoryImageCreateIn, HistoryImageUpdateIn
from app.security import current_user

router = APIRouter(prefix="/api/admin/history", tags=["history-images"])

settings = get_settings()
HISTORY_UPLOAD_DIR = settings.upload_dir / "history"
LANGUAGES = ("ru", "en")
FETCH_TIMEOUT_SECONDS = 15
USER_AGENT = "StreamArchiveBot/1.0"


def assert_public_url(url: str) -> None:
    """Не даём серверу сходить в собственную внутреннюю сеть.

    Ссылку выбирает не редактор, а исследовательская выдача, поэтому запрос
    по ней — это запрос по чужому адресу, и он может указывать на localhost
    или на приватный диапазон внутри инфраструктуры.
    """
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(status_code=422, detail="Поддерживаются только http и https")
    if not parsed.hostname:
        raise HTTPException(status_code=422, detail="В ссылке нет адреса хоста")
    try:
        infos = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror:
        raise HTTPException(status_code=422, detail="Адрес не разрешается в IP")
    for info in infos:
        address = ipaddress.ip_address(info[4][0])
        if address.is_private or address.is_loopback or address.is_link_local or address.is_reserved:
            raise HTTPException(status_code=422, detail="Ссылка ведёт во внутреннюю сеть")


def store_image(content: bytes) -> str:
    """Проверяем, что это действительно картинка, и приводим к одному виду."""
    limit = settings.max_image_size_mb * 1024 * 1024
    if len(content) > limit:
        raise HTTPException(status_code=413, detail=f"Файл больше {settings.max_image_size_mb} МБ")
    try:
        probe = Image.open(BytesIO(content))
        probe.verify()
        source = Image.open(BytesIO(content)).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=422, detail="По ссылке не изображение")
    source.thumbnail((2400, 2400))
    HISTORY_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}.webp"
    source.save(HISTORY_UPLOAD_DIR / filename, "WEBP", quality=86, method=6)
    # Адрес всегда от корня домена: история общая для RU и EN, и картинка
    # должна открываться с обоих сайтов по одной ссылке.
    return f"{settings.site_base_url.rstrip('/')}/uploads/history/{filename}"


def image_out(image: HistoryImage) -> dict:
    return {
        "id": image.id,
        "file_url": image.file_url,
        "source_url": image.source_url,
        "author": image.author,
        "license": image.license,
        "taken_at": image.taken_at,
        "sort_order": image.sort_order,
        "is_cover": image.is_cover,
        "review_status": image.review_status,
        "caption": {item.language: item.caption or "" for item in image.translations},
        "alt_text": {item.language: item.alt_text or "" for item in image.translations},
    }


def get_image_or_404(db: Session, image_id: int) -> HistoryImage:
    image = db.scalar(
        select(HistoryImage).options(selectinload(HistoryImage.translations)).where(HistoryImage.id == image_id)
    )
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    return image


@router.post("/events/{event_id}/images", response_model=HistoryImageAdminOut, status_code=201)
def add_image(event_id: int, payload: HistoryImageCreateIn, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    event = db.get(HistoryEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    image = HistoryImage(
        event_id=event_id,
        source_url=payload.source_url,
        author=payload.author,
        license=payload.license,
        review_status="candidate",
        sort_order=len(event.images),
    )
    db.add(image)
    db.commit()
    return image_out(get_image_or_404(db, image.id))


@router.post("/images/{image_id}/fetch", response_model=HistoryImageAdminOut)
def fetch_image(image_id: int, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Скачивает картинку по source_url и кладёт к себе.

    Статус остаётся candidate: скачали — ещё не значит решили показывать.
    Права на изображение проверяет человек, а не эта ручка.
    """
    image = get_image_or_404(db, image_id)
    if not image.source_url:
        raise HTTPException(status_code=422, detail="У изображения нет исходной ссылки")
    assert_public_url(image.source_url)
    request = UrlRequest(image.source_url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(request, timeout=FETCH_TIMEOUT_SECONDS) as response:
            content_type = (response.headers.get("Content-Type") or "").split(";")[0].strip().lower()
            if content_type and not content_type.startswith("image/"):
                raise HTTPException(status_code=422, detail=f"По ссылке не изображение, а {content_type}")
            content = response.read(settings.max_image_size_mb * 1024 * 1024 + 1)
    except HTTPException:
        raise
    except Exception as error:  # сетевые ошибки бывают самые разные
        raise HTTPException(status_code=422, detail=f"Не удалось скачать: {type(error).__name__}")

    image.file_url = store_image(content)
    db.commit()
    return image_out(get_image_or_404(db, image_id))


@router.post("/events/{event_id}/images/upload", response_model=HistoryImageAdminOut, status_code=201)
async def upload_history_image(
    event_id: int,
    image: UploadFile = File(...),
    _user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    event = db.get(HistoryEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    content = await image.read(settings.max_image_size_mb * 1024 * 1024 + 1)
    record = HistoryImage(
        event_id=event_id,
        file_url=store_image(content),
        review_status="approved",
        sort_order=len(event.images),
    )
    db.add(record)
    db.commit()
    return image_out(get_image_or_404(db, record.id))


@router.patch("/images/{image_id}", response_model=HistoryImageAdminOut)
def update_image(image_id: int, payload: HistoryImageUpdateIn, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    image = get_image_or_404(db, image_id)
    if payload.review_status == "approved" and not image.file_url:
        raise HTTPException(status_code=422, detail="Сначала скачайте файл: показывать чужую ссылку нельзя")
    for key, value in payload.model_dump(exclude_none=True, exclude={"caption", "alt_text"}).items():
        setattr(image, key, value)
    if payload.is_cover:
        # Обложка одна: остальные картинки события снимаем.
        for other in db.scalars(select(HistoryImage).where(HistoryImage.event_id == image.event_id)).all():
            other.is_cover = other.id == image.id
    existing = {item.language: item for item in image.translations}
    for language in LANGUAGES:
        caption = (payload.caption or {}).get(language)
        alt_text = (payload.alt_text or {}).get(language)
        if caption is None and alt_text is None:
            continue
        target = existing.get(language)
        if target is None:
            target = HistoryImageTranslation(image_id=image.id, language=language)
            image.translations.append(target)
        if caption is not None:
            target.caption = caption
        if alt_text is not None:
            target.alt_text = alt_text
    db.commit()
    return image_out(get_image_or_404(db, image_id))


@router.delete("/images/{image_id}", status_code=204)
def delete_image(image_id: int, _user: User = Depends(current_user), db: Session = Depends(get_db)) -> None:
    image = get_image_or_404(db, image_id)
    db.delete(image)
    db.commit()

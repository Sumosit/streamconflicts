"""Каркас истории: дерево разделов и первые опорные события.

Скрипт идемпотентный — сверяется по slug, поэтому его можно гонять повторно
после правок дерева. Запуск: python -m scripts.seed_history
"""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal  # noqa: E402
from app.models import (  # noqa: E402
    HistoryCategory,
    HistoryCategoryTranslation,
    HistoryEvent,
    HistoryEventCategory,
    HistoryEventTranslation,
    HistorySource,
    HistoryStatus,
)
from sqlalchemy import select  # noqa: E402

# (slug, ru, en, is_platform, [дети])
TREE: list[tuple] = [
    ("beginnings", "Начало стриминга", "The beginnings", False, []),
    ("platforms", "Платформы", "Platforms", False, [
        ("justin-tv", "Justin.tv", "Justin.tv", True, []),
        ("twitch", "Twitch", "Twitch", True, [
            ("twitch-launch-section", "Запуск", "Launch", False, []),
            ("twitch-amazon", "Покупка Amazon", "Amazon acquisition", False, []),
            ("twitch-partners", "Партнёрская программа", "Partner program", False, []),
            ("twitch-subscriptions", "Подписки", "Subscriptions", False, []),
            ("twitch-ads", "Реклама", "Advertising", False, []),
            ("twitch-raids", "Рейды", "Raids", False, []),
            ("twitch-rules", "Изменения правил", "Policy changes", False, []),
        ]),
        ("youtube", "YouTube", "YouTube", True, []),
        ("kick", "Kick", "Kick", True, []),
        ("trovo", "Trovo", "Trovo", True, []),
        ("mixer", "Mixer", "Mixer", True, []),
        ("ru-platforms", "Российские платформы", "Russian platforms", True, []),
        ("closed-platforms", "Закрытые платформы", "Shut down platforms", False, []),
    ]),
    ("technology", "Технологии", "Technology", False, []),
    ("culture", "Культура", "Culture", False, []),
    ("esports", "Киберспорт", "Esports", False, []),
    ("creators", "Создатели контента", "Creators", False, []),
    ("scandals", "Скандалы и конфликты", "Scandals and conflicts", False, []),
    ("legislation", "Законодательство", "Legislation", False, []),
    ("business", "Бизнес и монетизация", "Business and monetisation", False, []),
]

# Каркас первого прохода. Даты проставлены с той точностью, которую
# подтверждают источники: где известен только месяц, precision = month.
EVENTS: list[dict] = [
    {
        "slug": "justin-tv-launch",
        "date": date(2007, 3, 19),
        "precision": "day",
        "region": "global",
        "category": "justin-tv",
        "importance": 85,
        "ru": {
            "title": "Запуск Justin.tv",
            "summary": "Джастин Кан начал круглосуточную трансляцию своей жизни, и вокруг неё вырос сервис, из которого позже вышел Twitch.",
            "content": "19 марта 2007 года Джастин Кан запустил непрерывную трансляцию с камеры, закреплённой на кепке. Проект задумывался как один канал об одном человеке, но интерес аудитории быстро потребовал открыть площадку для сторонних вещателей.",
            "historical_context": "Видео в интернете в 2007 году означало запись: YouTube был библиотекой роликов, а не эфиром. Живая трансляция обычного человека была технически трудной и культурно непривычной.",
            "consequences": "Justin.tv превратился в открытую платформу с тысячами каналов. Игровой раздел внутри неё стал самым быстрорастущим и в 2011 году был выделен в отдельный сервис.",
        },
        "en": {
            "title": "Justin.tv launches",
            "summary": "Justin Kan began broadcasting his life around the clock, and the service that grew around it later produced Twitch.",
            "content": "On 19 March 2007 Justin Kan started a continuous broadcast from a camera mounted on his cap. The project began as a single channel about a single person, but audience interest quickly pushed it to open up to outside broadcasters.",
            "historical_context": "Online video in 2007 meant recordings: YouTube was a library of clips, not a live feed. A live broadcast by an ordinary person was both technically hard and culturally unfamiliar.",
            "consequences": "Justin.tv became an open platform with thousands of channels. Its gaming section grew fastest and was split off into a separate service in 2011.",
        },
        "sources": [
            {"url": "https://www.wired.com/2007/03/justintv/", "title": "Justin.tv and the lifecasting experiment", "publisher": "Wired", "language": "en"},
        ],
    },
    {
        "slug": "twitch-launch",
        "date": date(2011, 6, 6),
        "precision": "month",
        "region": "global",
        "category": "twitch-launch-section",
        "importance": 100,
        "ru": {
            "title": "Запуск Twitch",
            "summary": "Игровой раздел Justin.tv выделили в отдельный сервис Twitch.tv.",
            "content": "В июне 2011 года команда Justin.tv выделила игровые трансляции в самостоятельную площадку Twitch.tv. Решение опиралось на статистику: игровой раздел рос быстрее остальной платформы и требовал собственных инструментов — каталога по играм, качества потока и инструментов для вещателей.",
            "historical_context": "К 2011 году сложились три условия: широкополосный интернет стал массовым, киберспорт собирал заметную аудиторию, а на Justin.tv уже была критическая масса игровых каналов.",
            "consequences": "Twitch задал формат отрасли на десятилетие вперёд: каталог по играм, чат рядом с плеером, подписки на канал. Через три года платформу купила Amazon.",
        },
        "en": {
            "title": "Twitch launches",
            "summary": "Justin.tv's gaming section was spun out into a separate service, Twitch.tv.",
            "content": "In June 2011 the Justin.tv team spun gaming broadcasts out into a standalone site, Twitch.tv. The decision rested on usage data: the gaming section was growing faster than the rest of the platform and needed tools of its own — a directory by game, better stream quality, and broadcaster tooling.",
            "historical_context": "By 2011 three conditions had come together: broadband was mainstream, esports drew a measurable audience, and Justin.tv already hosted a critical mass of gaming channels.",
            "consequences": "Twitch set the industry's format for a decade: a directory by game, chat beside the player, channel subscriptions. Three years later Amazon acquired the platform.",
        },
        "sources": [
            {"url": "https://techcrunch.com/2011/06/06/justin-tv-launches-twitch-tv/", "title": "Justin.tv launches Twitch.tv", "publisher": "TechCrunch", "language": "en"},
        ],
    },
    {
        "slug": "twitch-amazon-acquisition",
        "date": date(2014, 8, 25),
        "precision": "day",
        "region": "global",
        "category": "twitch-amazon",
        "importance": 95,
        "ru": {
            "title": "Amazon покупает Twitch",
            "summary": "Amazon приобрела Twitch примерно за 970 миллионов долларов, обойдя Google.",
            "content": "25 августа 2014 года Amazon объявила о покупке Twitch. Сумма сделки составила около 970 миллионов долларов. До этого переговоры о покупке вёл Google, и рынок ожидал объединения Twitch с YouTube.",
            "historical_context": "Twitch к 2014 году входил в число крупнейших источников трафика в США, но оставался убыточным. Инфраструктура прямых трансляций дорога, а рекламная модель не покрывала расходы.",
            "consequences": "Сделка дала Twitch ресурсы Amazon: инфраструктуру, рекламные контракты и позже Twitch Prime. Одновременно платформа стала частью корпорации, что изменило подход к правилам и монетизации.",
        },
        "en": {
            "title": "Amazon acquires Twitch",
            "summary": "Amazon bought Twitch for roughly $970 million, beating out Google.",
            "content": "On 25 August 2014 Amazon announced its acquisition of Twitch for approximately $970 million. Google had been in talks to buy the platform beforehand, and the market had expected Twitch to be folded into YouTube.",
            "historical_context": "By 2014 Twitch was among the largest sources of US internet traffic yet remained unprofitable. Live streaming infrastructure is expensive, and advertising alone did not cover the cost.",
            "consequences": "The deal gave Twitch Amazon's resources: infrastructure, advertising contracts and later Twitch Prime. It also made the platform part of a corporation, which changed how it approached rules and monetisation.",
        },
        "sources": [
            {"url": "https://press.aboutamazon.com/2014/8/amazon-com-to-acquire-twitch", "title": "Amazon.com to acquire Twitch", "publisher": "Amazon", "language": "en"},
        ],
    },
    {
        "slug": "twitch-prime-launch",
        "date": date(2016, 9, 30),
        "precision": "month",
        "region": "global",
        "category": "twitch-subscriptions",
        "importance": 70,
        "ru": {
            "title": "Запуск Twitch Prime",
            "summary": "Подписчики Amazon Prime получили бесплатную подписку на один канал каждый месяц.",
            "content": "В сентябре 2016 года Amazon связала Prime и Twitch: подписчики Amazon Prime получили право бесплатно поддержать один канал в месяц, а также внутриигровые предметы и просмотр без рекламы.",
            "historical_context": "К 2016 году подписки стали основным доходом крупных каналов, но платящая доля аудитории оставалась небольшой. Amazon искала способ связать две свои подписки.",
            "consequences": "Prime-подписки заметно увеличили доход средних каналов и приучили аудиторию к ежемесячной поддержке. Позже сервис переименовали в Prime Gaming.",
        },
        "en": {
            "title": "Twitch Prime launches",
            "summary": "Amazon Prime members gained one free channel subscription every month.",
            "content": "In September 2016 Amazon tied Prime and Twitch together: Amazon Prime members could support one channel per month for free, and also received in-game items and ad-free viewing.",
            "historical_context": "By 2016 subscriptions were the main income for large channels, but the paying share of the audience stayed small. Amazon was looking for a way to link its two subscriptions.",
            "consequences": "Prime subscriptions noticeably raised income for mid-sized channels and habituated audiences to monthly support. The service was later renamed Prime Gaming.",
        },
        "sources": [
            {"url": "https://blog.twitch.tv/en/2016/09/30/twitch-prime-is-here-9e0b2c2f2a4a/", "title": "Twitch Prime is here", "publisher": "Twitch Blog", "language": "en"},
        ],
    },
    {
        "slug": "mixer-shutdown",
        "date": date(2020, 7, 22),
        "precision": "day",
        "region": "global",
        "category": "mixer",
        "importance": 80,
        "ru": {
            "title": "Закрытие Mixer",
            "summary": "Microsoft закрыла Mixer и передала аудиторию Facebook Gaming.",
            "content": "22 июля 2020 года Microsoft закрыла Mixer. Платформа не набрала аудиторию даже после дорогих переходов известных стримеров. Каналы и подписки предложили перенести в Facebook Gaming.",
            "historical_context": "В 2019 году Microsoft перекупила у Twitch нескольких крупных вещателей, рассчитывая, что зрители перейдут вслед за ними. Этого не произошло: аудитория осталась на привычной площадке.",
            "consequences": "Закрытие Mixer показало, что аудиторию нельзя перекупить вместе со стримером: зритель привязан к платформе не меньше, чем к автору.",
        },
        "en": {
            "title": "Mixer shuts down",
            "summary": "Microsoft closed Mixer and handed its audience to Facebook Gaming.",
            "content": "On 22 July 2020 Microsoft shut down Mixer. The platform had failed to build an audience even after expensive exclusivity deals with well-known streamers. Channels and subscriptions were offered a migration path to Facebook Gaming.",
            "historical_context": "In 2019 Microsoft signed several major broadcasters away from Twitch, expecting viewers to follow them. They did not: the audience stayed on the platform it knew.",
            "consequences": "Mixer's closure showed that an audience cannot be bought along with a streamer: viewers are attached to the platform at least as much as to the creator.",
        },
        "sources": [
            {"url": "https://www.theverge.com/2020/6/22/21298940/microsoft-mixer-shutting-down-facebook-gaming-partnership", "title": "Microsoft is shutting down Mixer", "publisher": "The Verge", "language": "en"},
        ],
    },
    {
        "slug": "kick-launch",
        "date": date(2022, 12, 1),
        "precision": "month",
        "region": "global",
        "category": "kick",
        "importance": 75,
        "ru": {
            "title": "Запуск Kick",
            "summary": "Появилась платформа с распределением дохода 95 на 5 в пользу стримера.",
            "content": "В конце 2022 года открылась Kick — площадка, построенная на двух обещаниях: доля стримера 95 процентов от подписки и более мягкая модерация, чем на Twitch.",
            "historical_context": "К 2022 году стандартная доля вещателя на Twitch составляла 50 процентов, а обсуждение условий партнёрских договоров стало постоянной темой в отрасли.",
            "consequences": "Kick оттянула часть заметных вещателей и вернула в повестку вопрос доли платформы. Одновременно мягкая модерация вызвала критику и споры о допустимом содержании эфиров.",
        },
        "en": {
            "title": "Kick launches",
            "summary": "A platform appeared offering a 95/5 revenue split in the streamer's favour.",
            "content": "Kick opened in late 2022, built on two promises: a 95 percent share of subscription revenue for the streamer and looser moderation than Twitch.",
            "historical_context": "By 2022 the standard broadcaster share on Twitch was 50 percent, and partner contract terms had become a constant subject of industry argument.",
            "consequences": "Kick drew away some prominent broadcasters and put the platform's revenue share back on the agenda. Its looser moderation also drew criticism and disputes over acceptable stream content.",
        },
        "sources": [
            {"url": "https://www.theverge.com/2023/6/16/23763687/kick-streaming-twitch-competitor-stake", "title": "Kick, the Twitch competitor", "publisher": "The Verge", "language": "en"},
        ],
    },
]


def upsert_category(db, slug: str, ru: str, en: str, is_platform: bool, parent_id: int | None, order: int) -> HistoryCategory:
    category = db.scalar(select(HistoryCategory).where(HistoryCategory.slug == slug))
    if not category:
        category = HistoryCategory(slug=slug)
        db.add(category)
    category.parent_id = parent_id
    category.is_platform = is_platform
    category.sort_order = order
    category.is_published = True
    db.flush()
    existing = {item.language: item for item in category.translations}
    for language, title in (("ru", ru), ("en", en)):
        if language in existing:
            existing[language].title = title
        else:
            db.add(HistoryCategoryTranslation(category_id=category.id, language=language, title=title))
    db.flush()
    return category


def seed_tree(db, nodes: list[tuple], parent_id: int | None = None) -> None:
    for order, (slug, ru, en, is_platform, children) in enumerate(nodes):
        category = upsert_category(db, slug, ru, en, is_platform, parent_id, order)
        seed_tree(db, children, category.id)


def seed_events(db) -> int:
    created = 0
    for spec in EVENTS:
        event = db.scalar(select(HistoryEvent).where(HistoryEvent.slug == spec["slug"]))
        if event:
            continue
        event = HistoryEvent(
            slug=spec["slug"],
            date_start=spec["date"],
            date_precision=spec["precision"],
            sort_date=spec["date"],
            year=spec["date"].year,
            region=spec["region"],
            importance=spec["importance"],
            status=HistoryStatus.PUBLISHED,
            is_published=True,
        )
        db.add(event)
        db.flush()
        for language in ("ru", "en"):
            text = spec[language]
            db.add(HistoryEventTranslation(
                event_id=event.id,
                language=language,
                title=text["title"],
                summary=text["summary"],
                content=text["content"],
                historical_context=text["historical_context"],
                consequences=text["consequences"],
                translation_status="reviewed",
            ))
        category = db.scalar(select(HistoryCategory).where(HistoryCategory.slug == spec["category"]))
        if category:
            db.add(HistoryEventCategory(event_id=event.id, category_id=category.id, is_primary=True))
        for order, source in enumerate(spec.get("sources", [])):
            db.add(HistorySource(event_id=event.id, sort_order=order, **source))
        created += 1
    return created


def main() -> None:
    with SessionLocal() as db:
        seed_tree(db, TREE)
        created = seed_events(db)
        db.commit()
        total = db.scalar(select(HistoryCategory).where(HistoryCategory.slug == "twitch"))
        print(f"Разделы синхронизированы (корень Twitch: id={total.id if total else '-'})")
        print(f"Новых событий: {created}")


if __name__ == "__main__":
    main()

"""Small classes for the festival programme and its scheduling rules."""

import json
import re
import unicodedata
from datetime import date, datetime, timedelta
from pathlib import Path


def make_slug(text):
    """Turn a name into a simple id, for example 'Inès Moreau' -> 'ines-moreau'."""
    plain_text = unicodedata.normalize("NFKD", text)
    plain_text = plain_text.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", plain_text.lower()).strip("-")


class Venue:
    def __init__(self, info):
        self.name = info["name"]
        self.capacity = info["capacity"]
        self.address = info["address"]
        self.slug = make_slug(self.name)

    def to_dict(self):
        return {
            "name": self.name,
            "capacity": self.capacity,
            "address": self.address,
            "slug": self.slug,
        }


class Artist:
    def __init__(self, info):
        self.name = info["name"]
        self.bio = info.get("bio", "")
        self.photo_url = info.get("photo_url", "")
        self.slug = make_slug(self.name)

    def to_dict(self):
        return {
            "name": self.name,
            "bio": self.bio,
            "photo_url": self.photo_url,
            "slug": self.slug,
        }


class Performance:
    """The shared information for every show, lineup, and workshop."""

    def __init__(self, info):
        self.id = info.get("id") or self.make_id(info)
        self.kind = info["kind"]
        self.title = info["title"]
        self.venue = info["venue"]
        self.start = info["start"]
        self.duration_minutes = int(info["duration_minutes"])
        self.description = info.get("description", "")

    @staticmethod
    def make_id(info):
        time_part = info["start"].replace(":", "").replace("T", "-")
        return f"{make_slug(info['title'])}-{time_part}"

    @property
    def start_time(self):
        return datetime.fromisoformat(self.start)

    @property
    def end_time(self):
        return self.start_time + timedelta(minutes=self.duration_minutes)

    @property
    def festival_day(self):
        # A festival night ends at 06:00, so a 01:00 show belongs to the night before.
        return (self.start_time - timedelta(hours=6)).date()

    def artists_involved(self):
        return set()

    def to_dict(self):
        return {
            "id": self.id,
            "kind": self.kind,
            "title": self.title,
            "venue": self.venue,
            "start": self.start,
            "duration_minutes": self.duration_minutes,
            "description": self.description,
        }


class SoloShow(Performance):
    def __init__(self, info):
        super().__init__(info)
        self.artist = info["artist"]
        self.min_age = int(info.get("min_age", 0))

    def artists_involved(self):
        return {self.artist}

    def to_dict(self):
        info = super().to_dict()
        info.update({"artist": self.artist, "min_age": self.min_age})
        return info


class Lineup(Performance):
    def __init__(self, info):
        super().__init__(info)
        self.host = info["host"]
        self.acts = list(info.get("acts", []))

    def artists_involved(self):
        return {self.host, *self.acts}

    def to_dict(self):
        info = super().to_dict()
        info.update({"host": self.host, "acts": self.acts})
        return info


class Workshop(Performance):
    def __init__(self, info):
        super().__init__(info)
        self.teacher = info["teacher"]
        self.max_participants = int(info.get("max_participants", 12))
        self.participants = list(info.get("participants", []))

    def artists_involved(self):
        return {self.teacher}

    def to_dict(self):
        info = super().to_dict()
        info.update(
            {
                "teacher": self.teacher,
                "max_participants": self.max_participants,
                "participants": self.participants,
            }
        )
        return info


def make_performance(info):
    """Create the right performance class from one JSON record."""
    classes = {"solo": SoloShow, "lineup": Lineup, "workshop": Workshop}
    kind = info.get("kind")
    if kind not in classes:
        raise ValueError("Choose solo, lineup, or workshop for the performance type.")
    return classes[kind](info)


class Festival:
    """Holds festival information and checks changes to the schedule."""

    def __init__(self, data_file):
        self.data_file = Path(data_file)
        self.read_data()

    def read_data(self):
        with self.data_file.open("r", encoding="utf-8") as file:
            data = json.load(file)

        self.name = data["name"]
        self.first_day = date.fromisoformat(data["first_day"])
        self.last_day = date.fromisoformat(data["last_day"])
        self.venues = {venue.slug: venue for venue in map(Venue, data["venues"])}
        self.artists = {artist.slug: artist for artist in map(Artist, data["artists"])}
        self.performances = [make_performance(item) for item in data["performances"]]

    def save_data(self):
        data = {
            "name": self.name,
            "first_day": self.first_day.isoformat(),
            "last_day": self.last_day.isoformat(),
            "venues": [venue.to_dict() for venue in self.venues.values()],
            "artists": [artist.to_dict() for artist in self.artists.values()],
            "performances": [show.to_dict() for show in self.performances],
        }
        with self.data_file.open("w", encoding="utf-8") as file:
            json.dump(data, file, ensure_ascii=False, indent=2)

    def show_by_id(self, show_id):
        for show in self.performances:
            if show.id == show_id:
                return show
        return None

    def sorted_performances(self, shows=None):
        if shows is None:
            shows = self.performances
        return sorted(shows, key=lambda show: (show.start_time, self.venues[show.venue].name))

    def performances_for_day(self, festival_day):
        wanted_day = date.fromisoformat(festival_day)
        shows = [show for show in self.performances if show.festival_day == wanted_day]
        return self.sorted_performances(shows)

    def performances_for_artist(self, artist_slug):
        shows = [show for show in self.performances if artist_slug in show.artists_involved()]
        return self.sorted_performances(shows)

    def live_at(self, moment):
        current = [show for show in self.performances if show.start_time <= moment < show.end_time]
        upcoming = [show for show in self.sorted_performances() if show.start_time > moment]
        return current, upcoming[:3]

    @staticmethod
    def times_overlap(first, second):
        return first.start_time < second.end_time and second.start_time < first.end_time

    def check_performance(self, show, ignore_id=None):
        if not 1 <= show.duration_minutes <= 360:
            raise ValueError("A performance must last from 1 to 360 minutes.")
        if show.venue not in self.venues:
            raise ValueError("Choose one of the listed festival venues.")
        if show.festival_day < self.first_day or show.festival_day > self.last_day:
            raise ValueError("This show starts outside the festival dates.")

        for artist_slug in show.artists_involved():
            if artist_slug not in self.artists:
                raise ValueError(f"Artist '{artist_slug}' is not in the festival list.")

        for other in self.performances:
            if other.id == ignore_id:
                continue
            if not self.times_overlap(show, other):
                continue
            if show.venue == other.venue:
                raise ValueError(f"{self.venues[show.venue].name} already has a show at that time.")
            busy_artists = show.artists_involved() & other.artists_involved()
            if busy_artists:
                artist_name = self.artists[sorted(busy_artists)[0]].name
                raise ValueError(f"{artist_name} is already part of another show at that time.")

    def add_performance(self, info):
        show = make_performance(info)
        self.check_performance(show)
        self.performances.append(show)
        self.save_data()
        return show

    def update_performance(self, show_id, info):
        old_show = self.show_by_id(show_id)
        if old_show is None:
            raise ValueError("That show could not be found.")
        updated_info = {**old_show.to_dict(), **info, "id": show_id}
        new_show = make_performance(updated_info)
        self.check_performance(new_show, ignore_id=show_id)
        index = self.performances.index(old_show)
        self.performances[index] = new_show
        self.save_data()
        return new_show

    def cancel_performance(self, show_id):
        show = self.show_by_id(show_id)
        if show is None:
            raise ValueError("That show could not be found.")
        self.performances.remove(show)
        self.save_data()

    def performance_dict(self, show):
        info = show.to_dict()
        info["venue_name"] = self.venues[show.venue].name
        info["day"] = show.festival_day.isoformat()
        info["end"] = show.end_time.isoformat(timespec="minutes")
        info["people"] = [self.artists[slug].name for slug in sorted(show.artists_involved())]
        if isinstance(show, SoloShow):
            info["artist_name"] = self.artists[show.artist].name
        elif isinstance(show, Lineup):
            info["host_name"] = self.artists[show.host].name
            info["act_names"] = [self.artists[slug].name for slug in show.acts]
        elif isinstance(show, Workshop):
            info["teacher_name"] = self.artists[show.teacher].name
        return info

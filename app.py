"""A small Flask app for the Deauville Festival du Rire programme."""

from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, render_template, request

from festival import Festival


ROOT_FOLDER = Path(__file__).parent
festival = Festival(ROOT_FOLDER / "data" / "festival.json")
app = Flask(__name__)


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/api/festival")
def festival_info():
    return jsonify(
        {
            "name": festival.name,
            "first_day": festival.first_day.isoformat(),
            "last_day": festival.last_day.isoformat(),
            "venue_count": len(festival.venues),
            "artist_count": len(festival.artists),
            "performance_count": len(festival.performances),
        }
    )


@app.get("/api/performances")
def all_performances():
    shows = [festival.performance_dict(show) for show in festival.sorted_performances()]
    return jsonify(shows)


@app.get("/api/programme")
def programme_for_day():
    festival_day = request.args.get("day", festival.first_day.isoformat())
    try:
        shows = festival.performances_for_day(festival_day)
    except ValueError:
        return jsonify({"error": "Enter a date in YYYY-MM-DD format."}), 400
    return jsonify([festival.performance_dict(show) for show in shows])


@app.get("/api/artists")
def artists():
    result = []
    for artist in festival.artists.values():
        artist_info = artist.to_dict()
        artist_info["performances"] = [
            festival.performance_dict(show)
            for show in festival.performances_for_artist(artist.slug)
        ]
        result.append(artist_info)
    return jsonify(result)


@app.get("/api/venues")
def venues():
    result = []
    for venue in festival.venues.values():
        venue_info = venue.to_dict()
        venue_info["performances"] = [
            festival.performance_dict(show)
            for show in festival.sorted_performances()
            if show.venue == venue.slug
        ]
        result.append(venue_info)
    return jsonify(result)


@app.get("/api/now")
def now_playing():
    moment_text = request.args.get("at")
    try:
        moment = datetime.fromisoformat(moment_text) if moment_text else datetime.now()
    except ValueError:
        return jsonify({"error": "Enter a date and time in YYYY-MM-DDTHH:MM format."}), 400

    playing, up_next = festival.live_at(moment)
    return jsonify(
        {
            "at": moment.isoformat(timespec="minutes"),
            "now_playing": [festival.performance_dict(show) for show in playing],
            "up_next": [festival.performance_dict(show) for show in up_next],
        }
    )


@app.post("/api/performances")
def add_performance():
    info = request.get_json(silent=True) or {}
    try:
        show = festival.add_performance(info)
        return jsonify(festival.performance_dict(show)), 201
    except (ValueError, KeyError, TypeError) as error:
        return jsonify({"error": str(error)}), 400


@app.put("/api/performances/<show_id>")
def change_performance(show_id):
    info = request.get_json(silent=True) or {}
    try:
        show = festival.update_performance(show_id, info)
        return jsonify(festival.performance_dict(show))
    except (ValueError, KeyError, TypeError) as error:
        return jsonify({"error": str(error)}), 400


@app.delete("/api/performances/<show_id>")
def remove_performance(show_id):
    try:
        festival.cancel_performance(show_id)
        return jsonify({"message": "The performance was cancelled."})
    except ValueError as error:
        return jsonify({"error": str(error)}), 404


if __name__ == "__main__":
    # This is meant for a local class project, not a public production server.
    app.run(host="127.0.0.1", port=5000, debug=True)

# Deauville Festival du Rire 2027

A small Python website for looking through the festival programme. It has the festival days, artist and venue pages, a “what is on now?” section, and a simple organiser page for adding, moving, and cancelling performances.

The project follows the idea in the [ECE Paris object-oriented Python track](https://github.com/nathanvid/ece-poo-track): Python manages the festival information and rules, while a web page displays it. This is a student-sized project with plain HTML, CSS, JavaScript, and a few Python classes.

## Run it on Windows

You need Python 3.11 or newer and `uv`.

1. Open this folder in VS Code.
2. Open a terminal in the folder and install the project dependency:

   ```powershell
   uv sync
   ```

3. Start the website:

   ```powershell
   uv run app.py
   ```

4. Open <http://127.0.0.1:5000> in your browser.

If you do not use `uv`, you can install Flask with `python -m pip install -r requirements.txt` and then run `python app.py`.

## What is on the site

- **Programme:** choose one of the four festival days and filter shows by type.
- **Artists and venues:** see their descriptions and scheduled performances.
- **On stage now:** choose a date and time to see what is playing and the next three shows.
- **Organiser:** add a show, change its details or time, and cancel it. Changes are saved in `data/festival.json`.

The organiser page is an open classroom demo; it has no password. Run the project locally and do not put it on a public server as-is.

## Scheduling rules in the Python code

- A performance lasts from 1 to 360 minutes.
- Its venue must be one of the festival venues, and its artists must be in the artist list.
- A venue cannot host two shows at the same time.
- An artist cannot be in two overlapping shows, including as a host, lineup act, or workshop teacher.
- The festival day changes at 06:00. For example, a show starting at 01:00 on 12 June belongs to the 11 June programme.

## Project files

- `app.py` contains the web pages and the small JSON API.
- `festival.py` contains the festival, venue, artist, and performance classes and the schedule checks.
- `data/festival.json` has the sample festival data.
- `templates/index.html` is the page layout.
- `static/` has the browser code and styles.

The sample names and programme come from the public course data. The site is an implementation exercise and is not the official festival website.

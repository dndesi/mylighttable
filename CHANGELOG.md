# Changelog

## V3.8

- Frontend: Neue Bilder und Änderungen erscheinen jetzt sofort statt erst
  nach bis zu 5 Minuten. Ursache war der Cache von raw.githubusercontent.com,
  der den bisherigen `?t=`-Trick ignorierte. Die App ruft ihre Daten jetzt über
  eine URL mit zufälliger Groß-/Kleinschreibung ab, die der Cache nicht kennt.
- Admin: Schlägt das Veröffentlichen auf GitHub fehl (z. B. Token abgelaufen),
  steht jetzt eine dauerhafte rote Meldung mit Hinweis auf „🔑 Token" da.
  Vorher wurde der Fehler von „Gespeichert ✓" überschrieben bzw. nur in die
  Browser-Konsole geschrieben — Bilder waren dann im Admin sichtbar, aber nie im
  Frontend.

## V3.7

- Ab dieser Version: **eine einheitliche App-Version** (`CONFIG.VERSION`)
  für Admin und Frontend zusammen, statt getrennter Admin-/Frontend-Zahlen
  wie bisher. Frühere Einträge unten behalten ihre alte Schreibweise.
- Admin: Versionsnummer im Header (oben links) ist jetzt anklickbar und
  zeigt diese Versionshistorie direkt in der App (lädt `CHANGELOG.md`
  live vom Repo). Im Frontend bleibt die Versionsnummer wie bisher nur
  Anzeige, ohne Klickfunktion.

## V3.6 (Frontend)

- Notiz wird bei JPEG-Downloads automatisch als EXIF-UserComment
  eingebettet (ZIP-Export und Einzelbild-Download, Karte + Lightbox) —
  Umlaute/Sonderzeichen korrekt (Unicode-EXIF-Feld). Videos und Bilder
  ohne Notiz werden unverändert wie bisher heruntergeladen (kein
  Performance-Nachteil). Neue Bibliothek: piexifjs (CDN, kein Server
  nötig). Schlägt die Einbettung fehl, wird automatisch die
  Original-Datei verwendet — Download bricht nie deswegen ab.

## V3.0 (Admin) / V3.5 (Frontend)

- Admin: Bewertung (1–5 Sterne) und Notiz pro Bild im Medien-Raster
  hinzufügbar (rein intern, nur für den Admin — keine Kunden-/Besucher-
  Bewertung). Schreibt in `galleries_index.json` (privat, Google Drive).
- Admin: öffentliche Galerie-Reihenfolge wird beim Speichern automatisch
  nach Bewertung sortiert (beste zuerst, unbewertete bleiben hinten in
  ursprünglicher Reihenfolge).
- Frontend: Sterne-Bewertung und Notiz werden pro Bild angezeigt (Notiz
  als scrollbares Feld mit fester Höhe, ca. 5 Zeilen). Beides erscheint
  nur, wenn tatsächlich vergeben.
- Hinweis: Das Changelog war vorher nicht durchgehend gepflegt worden
  (Sprung von V1.2 auf V3.x spiegelt die echte `?v=`-Historie in den
  Script-/CSS-Tags von `index.html`/`admin.html` wider, nicht neue
  Versionssprünge durch diese Änderung allein).

## V1.2

- Bildnamen im Frontend unter den Vorschaubildern anzeigen.

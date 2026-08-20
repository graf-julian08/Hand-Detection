# Wie funktioniert Hand Gesture AI?

> Der Live-Modus funktioniert sofort und braucht kein Training. MediaPipe findet die Handpunkte. Einfache Regeln prüfen, welche Finger ausgestreckt sind. Der Training Mode ist nur eine zusätzliche Demonstration für eigene Daten, KNN und den Train/Test Split.

## 1. Wie kommt das Kamerabild ins Programm?

Der Browser stellt mit `navigator.mediaDevices.getUserMedia()` einen Videostream der Webcam bereit. Dieser Stream wird in einem unsichtbaren `<video>`-Element abgespielt. In jedem Bild liest die App die aktuellen Daten aus. Der Webcam-Zugriff ist aus Sicherheitsgründen nur auf `localhost` oder einer HTTPS-Website erlaubt.

## 2. Wie wird die Hand gefunden?

MediaPipe bekommt das aktuelle Videobild. Das MediaPipe-Modell sucht darin eine Hand und liefert ihre Position. MediaPipe weiss hier aber nicht, was "Peace" oder "Fist" bedeutet. Diese Entscheidung trifft unser eigenes Programm.

## 3. Was sind die 21 Hand-Landmarks?

Landmarks sind 21 feste Punkte an der Hand. Es gibt einen Punkt am Handgelenk und vier Punkte an jedem Finger. Jeder Punkt hat drei Werte: `x` für die Breite, `y` für die Höhe und `z` für die Tiefe.

## 4. Welche Daten speichern wir beim Training?

Wir speichern keine Kamerabilder. Für jedes Beispiel speichern wir nur:

- den Namen der Geste, zum Beispiel `peace`
- 63 Zahlen als Merkmale (21 Punkte mal 3 Koordinaten)

Diese Daten liegen als JSON im `localStorage` des Browsers.

## 5. Was bekommt das ML-Modell als Input?

Rohe Koordinaten wären ungünstig. Eine Hand links im Bild hätte andere Werte als dieselbe Hand rechts im Bild. Deshalb macht das Programm drei Schritte:

1. **Verschieben:** Das Handgelenk wird zum Nullpunkt `(0, 0, 0)`.
2. **Drehen:** Die Hand wird am Mittelfinger ausgerichtet.
3. **Skalieren:** Alle Werte werden durch die Handflächengrosse geteilt.

Eine linke Hand wird ausserdem gespiegelt. Dadurch sehen gleiche Gesten für das Modell immer gleich aus.

## 6. Wie funktioniert K-Nearest Neighbors?

KNN bedeutet "K nächste Nachbarn". Das Modell merkt sich die Trainingsbeispiele. Bei einer neuen Hand berechnet es den Abstand zu allen gespeicherten Beispielen. Die fünf ähnlichsten Beispiele (`K = 5`) entscheiden über die Geste.

KNN passt gut zu diesem Projekt, weil der Algorithmus kurz und leicht zu verstehen ist. Es müssen keine komplizierten Formeln berechnet werden.

## 7. Wie wird das Modell trainiert?

Beim Klick auf **Modell trainieren** werden die Beispiele jeder Geste gemischt. 80 Prozent werden für das Training genutzt. 20 Prozent bleiben für den Test zurück. Anschliessend prüft die App das Modell mit den Test-Beispielen und speichert die Ergebnisse.

## 8. Was ist der Train/Test Split?

Wenn man mit denselben Daten trainiert und testet, lernt das Modell die Beispiele nur auswendig. Deshalb halten wir 20 Prozent der Daten zurück. Diese 20 Prozent simulieren neue Bilder. Der Split passiert getrennt pro Geste.

## 9. Wie berechnen wir die Accuracy?

Für jedes Test-Beispiel gibt das Modell eine Vorhersage ab. Danach zählt die App die richtigen Antworten:

`Accuracy = richtige Vorhersagen / alle Test-Vorhersagen`

18 richtige Antworten bei 20 Test-Beispielen ergeben zum Beispiel 90 Prozent.

## 10. Wie funktioniert die Live-Erkennung?

Die App wiederholt sehr schnell diese Schritte:

1. Kamerabild lesen
2. Hand und Punkte mit MediaPipe finden
3. 63 Merkmale erzeugen
4. prüfen, welche Finger ausgestreckt oder geschlossen sind
5. die passende Geste bestimmen
6. Geste und Confidence anzeigen

Die Punkte und Linien werden zusätzlich auf das Bild gezeichnet.

## 11. Wie wird die Confidence bestimmt?

Die fünf nächsten Nachbarn stimmen ab. Je näher ein Beispiel liegt, desto mehr zählt seine Stimme. Die Confidence zeigt, wie sicher sich die Nachbarn sind. Unter 62 Prozent zeigt die App **Unknown**.

## 12. Wo wird das trainierte Modell gespeichert?

Das Modell wird im `localStorage` des Browsers gespeichert. Es bleibt auch nach einem Neuladen der Seite erhalten. Es gibt keine Cloud und keinen Account.

## Die Demo-Steuerung

Eine erkannte Geste kann Aktionen auslösen:

- Thumbs Up: Lautstärke erhöhen
- Fist: Lautstärke verringern
- Peace: Play/Pause

Ein kurzes Zeitlimit verhindert, dass eine Geste zu oft hintereinander ausgelöst wird.

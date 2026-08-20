# Wie funktioniert Hand Gesture AI?

> Aktuelle vereinfachte Version: Der Live-Modus funktioniert sofort und braucht
> kein Training. MediaPipe findet die Handpunkte; verständliche Regeln prüfen,
> welche Finger ausgestreckt sind. Der Training Mode ist nur eine zusätzliche
> Demonstration für eigene Daten, KNN und Train/Test Split.

## 1. Wie kommt das Kamerabild ins Programm?

Der Browser stellt mit `navigator.mediaDevices.getUserMedia()` einen Videostream der Webcam bereit. Dieser Stream wird in einem unsichtbar gespiegelten `<video>`-Element abgespielt. In jedem Animationsframe liest die App das aktuelle Bild aus. Webcam-Zugriff ist aus Sicherheitsgründen nur auf `localhost` oder einer HTTPS-Website erlaubt.

## 2. Wie wird die Hand gefunden?

MediaPipe Hand Landmarker bekommt das aktuelle Videobild. Das bereits trainierte MediaPipe-Modell sucht darin eine Hand und liefert ihre Position. MediaPipe weiß hier aber nicht, was „Peace“ oder „Fist“ bedeutet. Diese Entscheidung trifft unser eigenes Modell.

## 3. Was sind die 21 Hand-Landmarks?

Landmarks sind markante Punkte an der Hand: ein Punkt am Handgelenk und jeweils vier Punkte an jedem der fünf Finger. Jeder Punkt besitzt `x`, `y` und `z`. `x` und `y` beschreiben die Position im Bild, `z` ungefähr die Tiefe relativ zur Hand.

## 4. Welche Daten speichern wir beim Training?

Wir speichern **keine Kamerabilder**. Für jeden Sample speichern wir nur:

- den Namen der gewählten Geste, zum Beispiel `peace`
- 63 Zahlen als Features: 21 Punkte × 3 Koordinaten

Diese Daten liegen als JSON im `localStorage` des Browsers.

## 5. Was bekommt das ML-Modell als Input?

Rohe Koordinaten wären ungünstig: Eine Hand links im Bild hätte andere Werte als dieselbe Hand rechts im Bild. Deshalb führt `extractFeatures()` drei Schritte aus:

1. **Verschieben:** Das Handgelenk wird zum Ursprung `(0, 0, 0)`.
2. **Drehen:** Die Hand wird an der Linie vom Handgelenk zum mittleren Finger ausgerichtet.
3. **Skalieren:** Alle Werte werden durch die Handflächengröße geteilt.

Eine linke Hand wird zusätzlich gespiegelt. Dadurch ähneln sich gleiche Gesten trotz Position, Größe, Drehung und Handseite stärker.

## 6. Wie funktioniert K-Nearest Neighbors?

KNN bedeutet „K nächste Nachbarn“. Das Modell merkt sich seine Trainingsbeispiele. Bei einer neuen Hand berechnet es den Abstand zu allen gespeicherten Beispielen. Die fünf ähnlichsten Beispiele (`K = 5`) stimmen über die Klasse ab. Nahe Beispiele bekommen dabei mehr Gewicht als weiter entfernte.

KNN passt gut zu diesem Projekt, weil der Algorithmus kurz, sichtbar und leicht erklärbar ist. „Training“ bedeutet hier hauptsächlich, gute Beispiele aufzubereiten und zu speichern – es müssen keine komplizierten Gewichte berechnet werden.

## 7. Wie wird das Modell trainiert?

Beim Klick auf **Modell trainieren** werden die Samples jeder Gestenklasse gemischt. 80 Prozent kommen in das Modell, 20 Prozent bleiben für den Test zurück. Anschließend prüft die App das Modell mit den Test-Samples und speichert Trainingsdaten, Accuracy und Zeitpunkt.

## 8. Was ist der Train/Test Split?

Würde man mit denselben Daten trainieren und testen, wäre ein gutes Ergebnis wenig aussagekräftig: Das Modell kennt diese Beispiele bereits. Deshalb halten wir 20 Prozent zurück. Diese simulieren neue, noch nicht gesehene Daten. Der Split passiert getrennt pro Klasse, damit jede aufgenommene Geste im Training und Test vertreten ist.

## 9. Wie berechnen wir die Accuracy?

Für jeden Test-Sample macht das Modell eine Prediction. Danach zählt die App die richtigen Antworten:

`Accuracy = richtige Predictions / alle Test-Predictions`

18 richtige Antworten bei 20 Test-Samples ergeben beispielsweise 90 Prozent. Eine hohe Accuracy ist hilfreich, aber ein kleiner oder sehr ähnlicher Datensatz kann das Ergebnis schöner erscheinen lassen, als die Erkennung im Alltag wirklich ist.

## 10. Wie funktioniert die Live-Erkennung?

Die App wiederholt sehr schnell diese Schritte:

1. aktuelles Kamerabild lesen
2. Hand und Landmarks mit MediaPipe finden
3. 63 normalisierte Features erzeugen
4. prüfen, welche Finger ausgestreckt oder geschlossen sind
5. daraus Daumen hoch, Faust, Peace, offene Hand oder Zeigefinger bestimmen
6. Geste und Confidence anzeigen

Die Landmark-Linien werden zusätzlich auf ein `<canvas>` über dem Video gezeichnet.

## 11. Wie wird die Confidence bestimmt?

Jeder der fünf nächsten Nachbarn stimmt für seine Klasse. Je kleiner sein Abstand zur aktuellen Hand ist, desto stärker zählt seine Stimme. Die Confidence ist der Anteil der Gewinnerklasse an allen gewichteten Stimmen. Unter 62 Prozent zeigt die App **Unknown**.

Diese Confidence ist keine mathematisch kalibrierte Wahrscheinlichkeit. Sie beschreibt, wie einig sich die nächsten Trainingsbeispiele sind.

## 12. Wo wird das trainierte Modell gespeichert?

Das Modell wird unter dem Schlüssel `hand-gesture-ai-model-v1` im `localStorage` gespeichert. Bei KNN besteht das Modell im Wesentlichen aus den vorbereiteten Trainingsbeispielen. Es bleibt auch nach einem Neuladen der Seite erhalten, aber nur in diesem Browser auf dieser Domain. Es gibt keine Cloud und keinen Account.

## Die Demo-Steuerung

Eine erkannte Geste verändert nur Elemente der Webseite:

- Thumbs Up → Lautstärke erhöhen
- Fist → Lautstärke verringern
- Peace → Play/Pause

Ein kurzes Zeitlimit verhindert, dass ein gehaltenes Zeichen die Aktion in jedem einzelnen Videoframe erneut ausführt.

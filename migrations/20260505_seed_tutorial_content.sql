-- Seed initial onboarding tutorial records into cms_tutorials
INSERT INTO cms_tutorials (id, slug, sort_order, title, content)
VALUES
(
  '3a565be7-bfdf-449d-8661-f2a112c63b42',
  'klaro-kurz-kennenlernen',
  10,
  '{"de": "Klaro kurz kennenlernen", "en": "Get to know Klaro quickly"}'::jsonb,
  $$[
    {
      "step_id": "step-1",
      "content": {
        "de": {
          "title": "Schritt-für-Schritt zum Antrag.",
          "text": "Vollständige Anträge können schneller von der Verwaltung bearbeitet werden.\n\nKlaros Fortschrittsanzeige zeigt Dir, was Du schon erledigt hast und was noch zu tun ist. So weißt Du jederzeit, wie weit Du bist."
        },
        "en": {
          "title": "Step-by-step to the application.",
          "text": "Complete applications can be processed faster by the administration.\n\nKlaro's progress indicator shows you what you have already done and what still needs to be done. So you know at all times how far you are."
        }
      }
    },
    {
      "step_id": "step-2",
      "content": {
        "de": {
          "title": "Deine Fortschritte werden gespeichert.",
          "text": "Dein Fortschritt wird automatisch gespeichert. So kannst Du Deinen Antragsprozess jederzeit unterbrechen und später fortsetzen."
        },
        "en": {
          "title": "Your progress is saved.",
          "text": "Your progress is automatically saved. So you can interrupt your application process at any time and continue later."
        }
      }
    },
    {
      "step_id": "step-3",
      "content": {
        "de": {
          "title": "Intelligente Dokumentanalyse",
          "text": "Wenn Du die Daten im Antrag nicht manuell ausfüllen möchtest, kannst Du uns stattdessen ein Dokument geben. Klaro analysiert das Dokument, findet für den Antrag relevante Informationen und speichert sie. Diese Funktion findest Du direkt am Anfang Deines Antrags."
        },
        "en": {
          "title": "Intelligent Document Analysis",
          "text": "If you do not want to fill in the data in the application manually, you can give us a document instead. Klaro analyzes the document, finds relevant info and saves it. You can find this at the start of your application."
        }
      }
    },
    {
      "step_id": "step-4",
      "content": {
        "de": {
          "title": "Dein persönlicher Assistent",
          "text": "Du brauchst Hilfe beim Ausfüllen des Antrags oder hast eine Frage zu Deinem Sozialhilfe-Anspruch? Der Klaro-Assistent beantwortet Dir Deine Fragen und ist nur einen Klick auf das \"Chat\"-Icon entfernt."
        },
        "en": {
          "title": "Your Personal Assistant",
          "text": "Need help filling out the application or have a question about your basic income entitlement? The Klaro assistant answers your questions and is just a click away on the chat icon."
        }
      }
    }
  ]$$::jsonb
),
(
  '8d8f41b2-c022-4a21-bc53-5d212eef32f1',
  'wie-funktioniert-die-applikation',
  20,
  '{"de": "Wie funktioniert die Applikation?", "en": "How does the application work?"}'::jsonb,
  $$[
    {
      "step_id": "step-1",
      "content": {
        "de": {
          "title": "Was ist Grundsicherung?",
          "text": "Grundsicherung ist eine finanzielle Unterstützung. Sie kann helfen, wenn du in der Altersrente bist oder aus gesundheitlichen Gründen nicht mehr arbeiten kannst und dein Geld für den Lebensunterhalt nicht reicht.\n\nMit Grundsicherung können zum Beispiel Kosten für den Alltag, die Wohnung und das Heizen unterstützt werden."
        },
        "en": {
          "title": "What is basic income?",
          "text": "Basic income is financial support. It can help if you are at retirement age or cannot work for health reasons and your money is not enough for living costs.\n\nWith basic income, support can be provided for daily costs, housing, and heating, for example."
        }
      }
    },
    {
      "step_id": "step-2",
      "content": {
        "de": {
          "title": "Soforthilfe in dringenden Situationen",
          "text": "Schon beantragt, aber noch kein Geld bekommen?\nDu hast Grundsicherung schon beantragt, aber für diesen Monat noch kein Geld bekommen? Dann kann in manchen Fällen ein Vorschuss möglich sein. Wende dich dafür an das Sozialamt in deinem Bezirk.\n\nAkute Notlage während der Prüfung?\nWenn dein Antrag noch geprüft wird und du gerade dringend Hilfe brauchst, kann es vorübergehende Hilfe geben, zum Beispiel für Essen, Unterkunft oder Heizung. Auch dafür ist das Sozialamt in deinem Bezirk zuständig.\n\nDu weißt nicht, welches Sozialamt zuständig ist?\nWenn du nicht weißt, welches Sozialamt für dich zuständig ist, hilft dir die Behördennummer 115 weiter."
        },
        "en": {
          "title": "Emergency assistance in urgent situations",
          "text": "Already applied, but haven't received money yet?\nHave you already applied for basic income but haven't received any money for this month? Then in some cases an advance may be possible. Contact the social welfare office in your district.\n\nAcute emergency during the audit?\nIf your application is still being reviewed and you need urgent help right now, temporary help can be given, for example for food, housing or heating. The social welfare office in your district is also responsible for this.\n\nYou do not know which social welfare office is responsible?\nIf you do not know which social welfare office is responsible for you, the public authorities number 115 will help you."
        }
      }
    }
  ]$$::jsonb
)
ON CONFLICT (slug) DO UPDATE
SET title = EXCLUDED.title, content = EXCLUDED.content, updated_at = NOW();

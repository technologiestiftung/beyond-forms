
UPDATE cms_tutorials
SET
  title = '{"de": "Wie funktioniert die Applikation?", "en": "How does the application work?"}'::jsonb,
  subtitle = '{"de": "Hier findest Du eine einfache Anleitung.", "en": "Here you''ll find a simple guide."}'::jsonb,
  content = $$[
    {
      "step_id": "step-1",
      "image": "tutorial-app-guide-step-1",
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
      "image": "tutorial-app-guide-step-2",
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
      "image": "tutorial-app-guide-step-3",
      "content": {
        "de": {
          "title": "Intelligente Dokumentanalyse",
          "text": "Wenn Du die Daten im Antrag nicht manuell ausfüllen möchtest, kannst Du Klaro stattdessen ein Dokument geben. Klaro analysiert das Dokument, findet für den Antrag relevante Informationen und speichert sie. Diese Funktion findest Du direkt am Anfang Deines Antrags."
        },
        "en": {
          "title": "Intelligent Document Analysis",
          "text": "If you do not want to fill in the data in the application manually, you can give us a document instead. Klaro analyzes the document, finds relevant info and saves it. You can find this at the start of your application."
        }
      }
    },
    {
      "step_id": "step-4",
      "image": "tutorial-app-guide-step-4",
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
  ]$$::jsonb,
  updated_at = NOW()
WHERE slug = 'wie-funktioniert-die-applikation';

UPDATE cms_tutorials
SET
  content = $$[
    {
      "step_id": "step-1",
      "content": {
        "de": {
          "title": "Was ist Grundsicherung?",
          "text": "Grundsicherung ist eine finanzielle Unterstützung. Sie kann helfen, wenn Du in der Altersrente bist oder aus gesundheitlichen Gründen nicht mehr arbeiten kannst und Dein Geld für den Lebensunterhalt nicht reicht.\n\nMit Grundsicherung können zum Beispiel Kosten für den Alltag, die Wohnung und das Heizen unterstützt werden."
        },
        "en": {
          "title": "What is basic income?",
          "text": "Basic income is financial support. It can help if you are at retirement age or cannot work for health reasons and your money is not enough for living costs.\n\nWith basic income, support can be provided for daily costs, housing, and heating, for example."
        }
      }
    }
  ]$$::jsonb,
  updated_at = NOW()
WHERE slug = 'was-ist-grundsicherung';

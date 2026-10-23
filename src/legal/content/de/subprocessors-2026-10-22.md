# Unterauftragsverarbeiter

> **Entwurf — in rechtlicher Prüfung.**

Version 2026-10-22.

Dies ist die Liste der Unterauftragsverarbeiter, die {{OPERATOR_NAME}} (der „Betreiber“) einsetzt, um Clubs Volley Skills (den „Dienst“) bereitzustellen. Sie ist Anlage III des Auftragsverarbeitungsvertrags (des „AVV“). Sie wird getrennt vom AVV versioniert: Änderungen werden 30 Tage im Voraus angekündigt, und ein Club kann wie in D5 des AVV geregelt widersprechen.

## Aktuelle Unterauftragsverarbeiter

| Unterauftragsverarbeiter | Dienst | Personenbezogene Daten | Standort und Grundlage der Übermittlung |
|---|---|---|---|
| Google Ireland Limited (Google Cloud / Firebase) | Cloud Firestore: die Datenbank des Dienstes | Alle Club-Daten | Europäische Union (EU-Multiregion-Standort eur3) |
| Google Ireland Limited (Google Cloud / Firebase) | Firebase Hosting: Auslieferung der Dateien der Webanwendung des Dienstes | Anfragedaten, etwa IP-Adresse und Browserangaben | Globales Netz von Google, das die Vereinigten Staaten einschließen kann: EU-US Data Privacy Framework und Standardvertragsklauseln |
| Google (Firebase Authentication) | Anmeldung mit E-Mail-Links und mit Google | E-Mail-Adressen von Personal und Mitgliedern, Anmelde-Metadaten sowie Name und Profilbild eines zur Anmeldung verwendeten Google-Kontos | Verarbeitung in den Vereinigten Staaten möglich: EU-US Data Privacy Framework und Standardvertragsklauseln |
| Google (reCAPTCHA, von App Check verwendet) | Schutz des Dienstes vor Missbrauch | Geräte- und Browsersignale, IP-Adresse | Vereinigte Staaten: EU-US Data Privacy Framework und Standardvertragsklauseln |

Die eigenen Unterauftragsverarbeiter, Zertifizierungen und Datenverarbeitungsbedingungen von Google werden von Google veröffentlicht.

## Keine Unterauftragsverarbeiter

Die folgenden sind keine Unterauftragsverarbeiter des Betreibers:

- **Vom Club gewählte KI-Anbieter.** KI-Funktionen sind standardmäßig ausgeschaltet, und ein Club-Administrator entscheidet, ob er sie einschaltet. Das Personal des Clubs wählt dann einen KI-Anbieter und nutzt dort seinen eigenen Schlüssel. Ein solcher KI-Anbieter ist der eigene Auftragsverarbeiter des Clubs, vom Club aufgrund seiner eigenen Vereinbarung mit dem Anbieter beauftragt. Er wird nicht vom Betreiber beauftragt und steht daher nicht auf dieser Liste. Die Anbieter-Voreinstellungen im Dienst, einschließlich einer etwaigen Kennzeichnung „recommended“, sind Komfort-Voreinstellungen und keine Beauftragung des Anbieters durch den Betreiber.
- **Ein Zahlungsdienstleister, sobald Zahlungen eingeführt werden.** Er verarbeitet Abrechnungsdaten im Rahmen der eigenen Verarbeitung des Betreibers als Verantwortlicher, die in der Datenschutzerklärung beschrieben ist, und nicht als Unterauftragsverarbeiter für Club-Daten.

## Änderungen dieser Liste

Vor dem Hinzufügen oder Ersetzen eines Unterauftragsverarbeiters veröffentlicht der Betreiber eine neue Fassung dieser Liste und kündigt dies den Clubs 30 Tage im Voraus an, durch ein den Club-Administratoren im Dienst angezeigtes Banner und durch eine E-Mail an die Referenz-E-Mail-Adresse jedes Clubs. Ein Club kann innerhalb von 15 Tagen nach der Ankündigung widersprechen, wie in D5 des AVV geregelt.

Fragen zu dieser Liste: {{OPERATOR_PRIVACY_EMAIL}}.

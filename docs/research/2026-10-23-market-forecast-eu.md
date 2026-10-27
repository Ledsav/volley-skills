# Forecast di mercato EU: club multi-squadra prima, top team dopo

Modello di prezzo ipotizzato: **5 utenti per club, €50-200 per utente l'anno a seconda delle feature**, quindi €250-1.000 per club. Il target d'ingresso sono i club federati non professionistici con molte squadre, in tutta Europa. Dopo una prima base installata si punta ai top team (che secondo l'ipotesi pagano €15-20k a stagione) passando dal canale CEV. In parallelo c'è un segmento amatoriale/aziendale con feature di gamification.

Con questo modello il quinto anno pagante (S5, 2031-32) vale circa **€117k (prudente), €480k (base) o €1,55M (ottimistico)** di ricavi. Il grosso viene sempre dai club multi-squadra; i top team pesano il 20-25% e servono soprattutto come referenze. Aprendo altri sport (basket e pallamano, poi calcio giovanile, poi accademie di tennis/padel) S5 sale a circa **€570k (base) o €2,07M (ottimistico)**; vedi sezione 4. Rispetto al report del 2026-10-20 (`2026-10-20-pricing-and-competitors.md`, base €104k a S5) i numeri sono più alti perché il target non è più solo Serie B e superiori, ma tutti i club multi-squadra federati, e il prezzo cresce con gli utenti e le feature.

*Come leggere: i numeri con link sono fonti; tutto ciò che è marcato "stima" o "ipotesi", e l'intero forecast, è modellazione di questo documento. Non è una consulenza finanziaria.*

## 1. Quanti club ci sono davvero

| Paese | Club affiliati | Tesserati | Tesserati per club | Fonte |
|---|---|---|---|---|
| Italia (FIPAV) | 3.911 (2025); 3.916 (2024) | 334.620 atleti (dic 2025); ~356k totali (2024) | ~86 | [FIPAV conferenza fine anno 2025](https://www.federvolley.it/sites/default/files/2025-12/PRESENTAZIONE%20PRESIDENTE.pdf), [Milano-Bicocca dic 2025](https://www.dismeq.unimib.it/sites/st03/files/Allegati/2025-12/ED_PRES_BICOCCA_17_DIC_2025_TESTO.pdf) |
| Francia (FFvolley) | 1.413 (ago 2025) | 245.281 | ~174 | [Fiche fédération, France Olympique](https://ressources-associations-sportives.franceolympique.com/api/media/sites/ressources_associations_sportives/files/2025-09/Fiche%20f%C3%A9d%C3%A9ration%20-%20FF%20Volley%20(2).pdf) |
| Germania (DVV) | ~7.000 società sportive (dato senza data) | ~408-436k | ~60 | [Wikipedia DVV](https://en.wikipedia.org/wiki/German_Volleyball_Association), [Statista 2024](https://de.statista.com/statistik/daten/studie/216149/umfrage/mitgliederzahl-des-deutschen-volleyball-verbandes) |
| Paesi Bassi (Nevobo) | 981 (2019) - ~1.200 | 112-125k | ~110 | [Wikipedia Nevobo](https://en.wikipedia.org/wiki/Nederlandse_Volleybalbond), [Landstede](https://www.landstedesportcentrum.nl/sportieve-vrienden/sportbonden-en-sportorganisaties/nederlandse-volleybalbond-nevobo/) |
| Polonia (PZPS) | ~900 | ~36.500 licenze | ~40 | [kwalifikacje.gov.pl, dati OSEKiZ](https://kwalifikacje.gov.pl/zrk2/kwalifikacja/13996&pdf=true) |
| Svizzera (Swiss Volley) | 447 | ~59-60k | ~130 | [Swiss Olympic 2024](https://swissolympic.ch/dam/jcr:7d75e9e5-ed16-49fc-bde8-762d80b0d443/Anzahl%20Vereine%20und%20(Aktiv-)Mitglieder%20pro%20Verband%202024_DE+FR.pdf) |
| Spagna (RFEVB) | non trovato | ~123k (stima: 2,8% di 4,38M licenze) | - | [Ministerio, Estadística deporte federado 2025](https://www.educacionfpydeportes.gob.es/va/dam/jcr:502bb031-390e-4eb7-8152-866d1c9a9632/estadistica-de-deporte-federado-2025.pdf) |
| Turchia (TVF) | non trovato | non trovato | - | - |

I sei paesi con dati fanno **circa 14.650 club**. La CEV ha 56 federazioni ([Wikipedia CEV](https://en.wikipedia.org/wiki/European_Volleyball_Confederation)); aggiungendo Spagna, Turchia, Belgio, Austria, Rep. Ceca, Portogallo, Grecia e gli altri, l'Europa conta **circa 23.000-27.000 club** (stima).

Il dato più utile per il target è il rapporto tesserati/club: in Italia sono **~86 atleti per club**, in Francia ~174, in Svizzera ~130. Il club medio non è una squadra sola, ma un'organizzazione con prima squadra, under e minivolley. È esattamente il cliente "tante squadre, nessun budget pro" (in Germania e Polonia la media è più bassa, e in Germania molte società sono sezioni di polisportive).

### Dimensione dei segmenti (stime)

| Segmento | Bacino | Prezzo | Valore teorico annuo |
|---|---|---|---|
| **A. Club multi-squadra federati** (≥4 squadre, ipotesi 35% dei club) | ~8.000-9.500 club in Europa; ~5.200 in IT+FR+DE+NL+CH | 5 utenti × €50-200 = €250-1.000 | **€2-9,5M** (€4-4,5M a €500 medi) |
| **B. Top team** (coppe CEV + massime serie) | >200 squadre iscritte alle coppe europee per stagione ([CEV](https://www.cev.eu/articles/club-volleyball/fans-to-expect-high-quality-competition-in-cev-cup-and-challenge-cup-2027/)); ~700-1.000 nelle prime 2-3 serie europee (report 2026-10-20) | €15-20k (ipotesi da verificare) | €3-4M sulle sole squadre di coppa |
| **C. Amatoriali e aziendali** | nessun dato aggregato trovato; esistono leghe UISP/CSI in Italia e corporate league locali ([Luxembourg Corporate League](https://www.chronicle.lu/category/sport/45794-luxembourg-corporate-leagues-now-include-football-basketball-volleyball)) | €99-129 per squadra | da validare |

## 2. Forecast a 5 stagioni

S1 = stagione 2027-28 (la multi-tenancy deve essere in produzione e la finestra di vendita è giugno-settembre 2027). Tutto è stima.

### Ipotesi

| Ipotesi | Prudente | Base | Ottimistico |
|---|---|---|---|
| Nuovi club A per stagione, S1-S5 | 20 / 40 / 60 / 80 / 100 | 30 / 70 / 120 / 170 / 220 | 60 / 150 / 280 / 400 / 500 |
| Churn annuo club A | 25% | 18% | 12% |
| Utenti per club, S1 → S5 | 5 | 5 → 6 | 5 → 6,5 |
| Prezzo medio per utente (mix feature), S1 → S5 | €70 → €80 | €90 → €115 | €100 → €140 |
| = Ricavo per club, S1 → S5 | €350 → €400 | €450 → €690 | €500 → €910 |
| Nuovi top team (B), S1-S5 | 0 / 0 / 0 / 1 / 1 | 0 / 1 / 1 / 2 / 2 | 0 / 2 / 3 / 4 / 5 |
| Prezzo top team | €12-15k | €12k → €17,5k | €15k → €20k |
| Squadre amatoriali/aziendali (C) | non lanciato | lancio S3: 60 / 150 / 250 nuove, churn 30%, €99 | lancio S2: 100 → 900 nuove, churn 30%, €129 |
| Lingue | IT, EN | IT, EN, ES, FR, DE entro S3 | + NL, PL; accordo federale da S2 |

### Risultati

| Stagione | Prudente | Base | Ottimistico |
|---|---|---|---|
| S1 2027-28 | 20 club · **€7k** | 30 club · **€14k** | 60 club · **€30k** |
| S2 2028-29 | 55 club · **€19k** | 95 club + 1 top · **€60k** | 203 club + 2 top + 100 sq. C · **€171k** |
| S3 2029-30 | 101 club · **€38k** | 198 club + 2 top + 60 sq. C · **€150k** | 459 club + 5 top + 370 sq. C · **€480k** |
| S4 2030-31 | 156 club + 1 top · **€74k** | 332 club + 4 top + 192 sq. C · **€280k** | 804 club + 9 top + 859 sq. C · **€920k** |
| S5 2031-32 | 217 club + 2 top · **€117k** | 492 club + 6 top + 384 sq. C · **€483k** | 1.208 club + 13 top + 1.501 sq. C · **€1,55M** |
| **Cumulato 5 stagioni** | **€255k** | **€986k** | **€3,15M** |
| Peso a S5: A / B / C | 74% / 26% / 0% | 70% / 22% / 8% | 71% / 17% / 12% |
| Penetrazione A a S5 (su ~5.200 club nei 5 paesi principali) | 4% | 9% | 23% |

Costi variabili come nel report del 2026-10-20: ~6% pagamenti con merchant of record (Paddle), ~€10 per club per infrastruttura e AI. Oltre i ~200-300 club attivi serve almeno una persona di supporto (stima): lo scenario base implica 1-2 assunzioni entro S4, l'ottimistico un piccolo team. Il prudente resta un progetto da una persona.

## 3. Cosa dicono i numeri sulla strategia

**Il prezzo per utente funziona come scala, non come contatore.** €50-200 per utente porta il club medio a €450-700, in linea con i riferimenti trovati (Sportlyzer €1.000 a club, DV4 Lite €299 a licenza, GMS+ ~€107 a coach). Il rischio è che le associazioni condividano un login per pagare meno posti. Meglio vendere pacchetti per club con 5 utenti inclusi e livelli di feature (es. Base €250, Plus €500, Pro €1.000), più utenti extra a €50. Il ricavo è lo stesso, ma non si incentiva la condivisione delle credenziali.

**La leva vera è il churn, poi il numero di club, poi il prezzo.** Nel base, passare dal 18% al 25% di churn toglie più ricavo a S5 che scendere da €115 a €90 per utente. Lo storico pluriennale dei giocatori (schede, test fisici, piani di sviluppo) è ciò che rende costoso andarsene, ed è già nel prodotto.

**I top team a €15-20k non sono verificati, e il canale CEV è il terreno dell'incumbent.** Nessuna fonte mostra un club che paga €15-20k per un singolo strumento: DataVolley 4 Pro costa €799 a licenza, SmashVision Elite €10k a stagione, Catapult supera i $30k di ACV ma vende wearable e monitoraggio (fonti nel report del 2026-10-20). €15-20k è plausibile come costo dell'intero stack di un top club (più licenze DV, video, tablet, AI, wearable). Inoltre una linea guida CEV del 2015 ha reso obbligatorio il software Data Project nelle partite CEV ([CEV](https://inside.cev.eu/media/eulhmot0/dataproject-software-guidelines.pdf)), e Data Project appartiene a Genius Sports. "Spodestare" passando dalla CEV significa quindi ottenere che la CEV accetti un secondo sistema. Con l'import `.dvw` (già progettato) la via realistica è entrare dai top team come complemento (sviluppo, allenamenti, settore giovanile, awards) e usare la CEV per i programmi di sviluppo e i settori giovanili, non per sostituire lo scouting ufficiale. Il forecast tiene i top team al 17-26% del ricavo proprio per questo.

**Amatoriali e aziendali: volume alto, prezzo basso, churn alto.** Non ci sono dati aggregati, quindi il segmento entra solo nel base (da S3) e nell'ottimistico (da S2). Funziona solo self-service, senza onboarding: gamification (classifiche, badge, awards story condivisibili), prezzo per squadra e pagamento con carta. Per le aziende si vende come welfare/team building all'ufficio HR, non al coach. Il segmento ha anche un valore di marketing: ogni awards story condivisa porta visibilità ai segmenti A e B.

## 4. Scalare ad altri sport

Allargare ad altri sport aggiunge circa **€86k a S5 nello scenario base (S5 totale ~€570k) e circa €510k nell'ottimistico (S5 totale ~€2,07M)**. Il prudente resta solo pallavolo. Gli altri sport entrano dopo che il prodotto pallavolo regge da solo (S3-S4): hanno bacini molto più grandi, ma la concorrenza è più forte e i ricavi partono più tardi.

### Cosa si riusa del prodotto

Il codice in `src/` conta circa 32.000 righe (test esclusi). La parte legata alla pallavolo è circa il 35%: lo scouting e il motore di replay (`src/matches/`, ~5.100 righe), il costruttore di diagrammi sul campo da pallavolo (`src/diagrams/`, ~3.100), le 8 skill e la scala 1-10 cablate nel codice, le statistiche degli awards e l'import `.dvw`. Il resto è già indipendente dallo sport: piattaforma multi-club, ruoli e accessi, squadre, schede giocatore, test fisici, libreria esercizi, allenamenti e PDF, calendari, bozze AI, documenti legali, export. È una stima per righe di codice, non per effort.

Per un secondo sport serve un **"pacchetto sport"** configurabile: elenco di skill e guide di valutazione, campo per i diagrammi, eventi di scouting e statistiche, voci degli awards. Oggi le 8 skill sono cablate per scelta di prodotto, quindi la modifica principale è renderle un dato del club o della squadra. Le polisportive (molte società tedesche e italiane) chiedono uno sport per squadra, non per club.

### Quanto sono grandi gli altri mercati

| Sport | Dati trovati | Fonte | Concorrenza |
|---|---|---|---|
| **Calcio** | Germania: 23.713 club, 144.007 squadre (2025-26). Italia: 8.822 club LND, 1,13M calciatori tesserati (2023-24) | [DFB](https://www.dfb.de/news/dfb-mitgliederstatistik-positive-signale-bei-maedchenteams-kindern-und-schiris), [Sole 24 Ore Lab](https://lab24.ilsole24ore.com/guasto-calcio-italiano/), [FIGC ReportCalcio 2025](https://www.figc.it/media/277126/report-calcio-2025.pdf) | Molto alta: Hudl, 360Player, TeamSnap, XPS, Sportlyzer, e Spond gratuito ([G2](https://www.g2.com/products/360player/pricing)) |
| **Basket** | Italia: 3.164 società, 173k atleti (2022-23) | [ItaliaOggi, report sostenibilità FIP](https://www.italiaoggi.it/settori/sport/federbasket-in-crescita-gmqxb0lm) | Media: Hudl e strumenti di scouting/video, pochi prodotti per lo sviluppo del giocatore nei club |
| **Pallamano** | Spagna: 869 club, ~100k tesserati (2023); EHF: 50 federazioni | [Wikipedia RFEBM](https://en.wikipedia.org/wiki/Royal_Spanish_Handball_Federation), [EHF](https://www.eurohandball.com/en/who-we-are/) | Bassa-media: mercato simile alla pallavolo (indoor, club multi-squadra, forte nel Nord e Centro Europa) |
| **Tennis / padel** | Italia: 4.096 circoli, 1,15M tesserati (2024) | [QuiFinanza, Report FITP 2024](https://quifinanza.it/sport-economy/atp-finals-torino-2025-numeri/938742/) | Alta sulle prenotazioni: Playtomic >6.700 club partner ([Silicon Canals](https://siliconcanals.com/playtomic-secures-e65m/)), MATCHi >1.600 strutture nel 2022 ([Cuatrecasas](https://www.cuatrecasas.com/en/global/article/matchi-consolidates-position-as-leading-racket-sports-platform-after-joining-forces-with-tpc-matchpo)) |

Solo il calcio in Italia e Germania vale circa 32.500 club, più del doppio dei club di pallavolo nei sei paesi della sezione 1. Ma ogni club ha già un'app gratuita o economica per la logistica, quindi lì si vende solo la parte di sviluppo del giocatore e di pianificazione degli allenamenti, a prezzo più basso.

Il tennis è un caso diverso. È uno sport individuale e i circoli comprano soprattutto software di prenotazione campi, un mercato già presidiato. Il prodotto adatto è per le **scuole tennis e le accademie** (maestri, gruppi di allievi, schede di sviluppo, test fisici, piani di allenamento), non per il circolo come struttura. Richiede un adattamento più profondo: niente squadre, gruppi di allenamento al loro posto.

### Ordine consigliato

1. **Basket e pallamano (da S3-S4).** Sono indoor, hanno club multi-squadra e diagrammi su campo simili, e la concorrenza nel segmento sviluppo è più bassa. La pallamano ha anche una distribuzione geografica complementare (Germania, Francia, Spagna, Scandinavia, Est Europa).
2. **Calcio giovanile (da S4-S5).** È il bacino più grande, ma il più affollato. Entrare con il settore giovanile (schede, test fisici, libreria esercizi, PDF delle sedute) e non con logistica o comunicazione, dove Spond è gratuito.
3. **Accademie di tennis e padel (da S5, solo ottimistico).** Serve una variante del prodotto senza squadre.

### Effetto sul forecast (stime)

| Ipotesi | Base | Ottimistico |
|---|---|---|
| Basket + pallamano | lancio S4: 40 / 80 nuovi club, churn 18%, €500-550 a club | lancio S3: 60 / 150 / 250 nuovi club, churn 14%, €550-750 |
| Calcio giovanile | lancio S5: 60 nuovi club, churn 22%, €400 | lancio S4: 100 / 250 nuovi club, churn 20%, €450-500 |
| Accademie tennis/padel | - | lancio S5: 100 accademie, churn 25%, €300 |

| Stagione | Base: solo pallavolo → con altri sport | Ottimistico: solo pallavolo → con altri sport |
|---|---|---|
| S3 2029-30 | €150k → €150k | €480k → €513k |
| S4 2030-31 | €280k → €300k | €920k → €1,10M |
| S5 2031-32 | €483k → **€569k** | €1,55M → **€2,07M** |
| Cumulato 5 stagioni | €986k → **€1,09M** | €3,15M → **€3,88M** |

Il guadagno vero degli altri sport arriva dopo S5: i club acquisiti a S4-S5 crescono come quelli della pallavolo negli anni 1-3. Il rischio principale è di focus. Ogni sport nuovo richiede contenuti (guide di valutazione, esercizi di esempio), canali di vendita e supporto propri, e un solo fondatore non può aprire un secondo sport prima che la pallavolo cresca senza di lui. Per questo lo scenario base lo apre solo a S4.

## 5. Cosa verificare prima di usare questi numeri

1. **Quota di club con ≥4 squadre.** Il 35% è un'ipotesi. FIPAV pubblica squadre iscritte per campionato; incrociandole con le 3.911 società si ottiene il dato reale per l'Italia.
2. **Spesa reale dei top team.** 5-10 telefonate a team manager di SuperLega, A1, PlusLiga: quanto spendono in software e cosa è incluso nei €15-20k.
3. **Disponibilità a pagare per utente** nei club di Serie C-D e B2: 10-15 interviste con direttori tecnici, mostrando i tre livelli di prezzo.
4. **Dati mancanti:** numero di club in Spagna e Turchia, leghe UISP/CSI/aziendali in Italia.
5. **Canale CEV:** quali programmi CEV (sviluppo, giovanili, coach education) possono ospitare un partner software senza toccare l'esclusiva di scouting.
6. **Altri sport:** 5-10 interviste con direttori tecnici di club di basket e pallamano prima di costruire il pacchetto sport; dati aggiornati FIP e FIGH; prezzo reale dei concorrenti nel calcio giovanile (360Player e XPS non pubblicano i prezzi).

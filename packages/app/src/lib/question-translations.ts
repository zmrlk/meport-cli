/**
 * Question translations — translates question text, options, and placeholders
 * based on locale. Covers all tiers progressively.
 *
 * IDs must match the question bank JSONs exactly:
 *   tier-0: t0_q01(name), t0_q02(lang), t0_q03(location), t0_q04(age),
 *           t0_q05(pronouns), t0_q06(use case), t0_q07(role), t0_q08(tech),
 *           t0_q09(frustration)
 */

interface QuestionTranslation {
  question?: string;
  placeholder?: string;
  why_this_matters?: string;
  options?: Record<string, string>; // value → translated label
}

type TranslationMap = Record<string, QuestionTranslation>;

const pl: TranslationMap = {
  // ─── Tier 0: Identity ───
  t0_q01: {
    question: "Jak AI powinno się do Ciebie zwracać?",
    placeholder: "Imię, pseudonim, lub cokolwiek pasuje",
    why_this_matters: "AI używa tego za każdym razem gdy się do Ciebie zwraca.",
  },
  t0_q02: {
    question: "W jakim języku AI powinno odpowiadać?",
    why_this_matters: "AI dostosuje język wszystkich odpowiedzi.",
    options: {
      en: "English",
      pl: "Polish / Polski",
      de: "German / Deutsch",
      es: "Spanish / Español",
      fr: "French / Français",
      other: "Inny",
    },
  },
  t0_q03: {
    question: "Gdzie na świecie jesteś?",
    why_this_matters: "Daty, godziny i waluty w odpowiedziach AI dopasują się do Twojej lokalizacji.",
    options: {
      europe_central: "Europa Środkowa (PL, CZ, SK, HU...)",
      europe_west: "Europa Zachodnia (UK, DE, FR...)",
      us_east: "Wschodnie Wybrzeże USA",
      us_west: "Zachodnie Wybrzeże USA",
      asia_pacific: "Azja / Pacyfik",
      other: "Gdzieś indziej",
    },
  },
  t0_q03a: {
    question: "Jaka jest Twoja strefa czasowa?",
    placeholder: "np. GMT+1, Warszawa, Tokio...",
  },
  t0_q04: {
    question: "Ile masz lat? (w przybliżeniu)",
    why_this_matters: "AI kalibruje odniesienia kulturowe i styl komunikacji do Twojego pokolenia.",
    options: {
      under_20: "Poniżej 20",
      "20_29": "20-kilka",
      "30_39": "30-kilka",
      "40_49": "40-kilka",
      "50_plus": "50+",
      skip: "Wolę nie mówić",
    },
  },
  t0_q05: {
    question: "Jakie zaimki preferujesz?",
    why_this_matters: "AI używa poprawnych zaimków gdy o Tobie mówi — mały detal, duża różnica.",
    options: {
      he: "On / Jego",
      she: "Ona / Jej",
      they: "Oni / Ich (neutralne)",
      no_preference: "Bez preferencji — nie ma znaczenia",
      skip: "Pomiń to",
    },
  },
  t0_q06: {
    question: "Po co budujesz ten profil?",
    why_this_matters: "Wpływa na to, jakie formaty eksportu dostaniesz na końcu.",
    options: {
      better_chat: "Lepsze rozmowy z AI",
      dev_tools: "Konfiguracja asystenta kodowania",
      local_llm: "Lokalne / prywatne AI (Ollama, LM Studio...)",
      all_of_it: "Wszystko powyższe — używam wielu narzędzi AI",
    },
  },
  t0_q07: {
    question: "Czym się zajmujesz? (ogólnie)",
    why_this_matters: "AI dopasuje słownictwo do Twojej branży i głębokość wyjaśnień.",
    options: {
      developer: "Programista / Developer",
      designer: "Designer / Kreatywny",
      founder: "Founder / Przedsiębiorca",
      manager: "Manager / Team Lead",
      knowledge_worker: "Pisarz / Badacz / Analityk",
      student: "Student",
      other: "Coś zupełnie innego",
    },
  },
  t0_q07a: {
    question: "Jaka jest Twoja branża lub rola?",
    placeholder: "np. pielęgniarka, kucharz, muzyk, nauczyciel...",
  },
  t0_q08: {
    question: "Na skali 0-10 — jak bardzo techniczny/a jesteś?",
    why_this_matters: "AI dostosuje techniczny poziom odpowiedzi — zero żargonu dla nie-devów, zero tłumaczenia podstaw dla ekspertów.",
    options: {
      "0_3": "0-3: Używam aplikacji i googlam",
      "4_6": "4-6: Ogarniam, ale nie koduję",
      "7_9": "7-9: Koduję i eksperymentuję",
      "10": "10: Buduję rzeczy dla innych ludzi",
    },
  },
  t0_q09: {
    question: "Ostatnie pytanie: co najbardziej Cię frustruje w asystentach AI?",
    why_this_matters: "AI będzie aktywnie unikać tego co Cię denerwuje.",
    options: {
      too_generic: "Odpowiedzi są generyczne, jakby dla każdego",
      too_verbose: "Za dużo mówi i moralizuje",
      re_explain: "Muszę tłumaczyć kontekst od nowa za każdym razem",
      format: "Zły format — esej gdy chcę punktory, punktory gdy chcę szczegóły",
      platform_switching: "Używam 3+ narzędzi AI i muszę konfigurować każde osobno",
    },
  },

  // ─── Tier 1: Communication DNA ───
  t1_q01: {
    question: "Pytasz AI o coś i dostajesz 6 akapitów, gdy chciałeś krótką odpowiedź. Twoja reakcja?",
    why_this_matters: "Kalibruje domyślną długość odpowiedzi we wszystkich eksportach AI.",
    options: {
      annoyed: "Lekko irytujące — przeskakuję do właściwej odpowiedzi",
      really_annoyed: "Naprawdę frustrujące — to mój największy problem z AI",
      depends: "Zależy od pytania — złożone tematy zasługują na więcej",
      fine: "Spoko — lubię widzieć pełne rozumowanie",
    },
  },
  t1_q01a: {
    question: "Jaki jest Twój idealny domyślny styl odpowiedzi?",
    options: {
      one_to_three_lines: "1-3 linijki na proste rzeczy, rozwijaj tylko gdy poproszę",
      bullet_first: "Punktory domyślnie, bez wstępu",
      short_paragraphs: "Krótkie akapity, max 5-7 linii",
    },
  },
  t1_q02: {
    question: "Znajomy pisze: 'Mów wprost, dam radę.' To zdanie jest...",
    why_this_matters: "Wpływa na to jak AI dostarcza oceny, feedback i złe wiadomości.",
    options: {
      exactly_me: "Dokładnie tak bym powiedział",
      relatable: "Ogólnie wolę bezpośredniość",
      context_dependent: "Zależy — wprost przy faktach, delikatniej przy emocjach",
      prefer_tact: "Wolę takt — bezpośredniość bez ciepła jest ostra",
    },
  },
  t1_q03: {
    question: "Kiedy AI coś tłumaczy, jaki format najlepiej do Ciebie trafia?",
    why_this_matters: "AI domyślnie używa preferowanej przez Ciebie struktury.",
    options: {
      bullet_points: "Punktory — szybkie, czytelne",
      numbered_steps: "Ponumerowane kroki — jasna kolejność",
      prose: "Płynna proza — naturalny tekst bez fragmentacji",
      tables: "Tabele / porównania — zestawienia obok siebie",
      code_blocks: "Bloki kodu — sformatowane, gotowe do skopiowania",
    },
  },
  t1_q04: {
    question: "Emoji w odpowiedziach AI — Twoja szczera opinia?",
    why_this_matters: "Brzmi banalnie, ale to jedna z głównych skarg na ton AI.",
    options: {
      hate_them: "Proszę nie. Wyglądają fałszywie i infantylnie.",
      sparingly: "Czasami ok — tylko nie w każdym zdaniu",
      neutral: "Nie zauważam ich specjalnie",
      like_them: "Lubię — dodają osobowości i czytelności",
    },
  },
  t1_q05: {
    question: "AI kończy wyjaśnienie słowami 'Daj znać jeśli chcesz żebym rozwinął!' — czujesz...",
    why_this_matters: "Usuwa nawyki AI które są grzeczne ale czujesz że puste.",
    options: {
      filler_hate: "Dokładnie ten filler chcę usunąć",
      mildly_annoyed: "Lekko irytujące, ale nie przeszkadza",
      fine: "Ok — pomocne przypomnienie że mogę kontynuować",
      dont_notice: "Szczerze? Nie zauważam",
    },
  },
  t1_q06: {
    question: "Złożone pytanie. AI daje krótką odpowiedź i pyta 'chcesz więcej?' vs od razu pełny rozkład. Co wolisz?",
    why_this_matters: "AI uczy się czy dawać Ci nagłówek czy całą historię domyślnie.",
    options: {
      short_first: "Krótka odpowiedź, poproszę o więcej jeśli zechcę",
      full_breakdown: "Pełny rozkład od razu — nie lubię gry w ping-ponga",
      depends_question: "Zależy od rodzaju pytania",
    },
  },
  t1_q07: {
    question: "Skończyłeś trudne zadanie. AI mówi 'Świetna robota, powinieneś być z siebie dumny!' Twoja reakcja?",
    why_this_matters: "AI wie czy świętować z Tobą czy po prostu potwierdzić i jechać dalej.",
    options: {
      cringe: "Cringe. Daruj sobie cheerleading.",
      neutral_prefer: "Neutralne potwierdzenie ok, nadmiar pochwał nie",
      actually_nice: "Szczerze? Nie przeszkadza. Motywujące.",
      love_it: "Dawaj WSZYSTKIE pochwały",
    },
  },
  t1_q08: {
    question: "Humor w rozmowach z AI — gdzie jesteś?",
    why_this_matters: "Kalibruje osobowość AI od surowego asystenta do przyjemnego partnera.",
    options: {
      no_humor: "Tylko tryb profesjonalny — trzymaj się tematu",
      dry_wit: "Suchy dowcip lub sprytne obserwacje — tak proszę",
      light_humor: "Lekki humor tu i tam — przyjemniej się rozmawia",
      bring_it: "Pełna osobowość — chcę żeby AI było fajne",
    },
  },
  t1_q09: {
    question: "Pokazujesz AI swoją pracę i prosisz o feedback. Chcesz żeby...",
    why_this_matters: "Wpływa na to jak AI podchodzi do wszystkiego co dajesz do oceny.",
    options: {
      brutal: "Było brutalne — nie potrzebuję owijania, potrzebuję prawdy",
      balanced_direct: "Szczere i bezpośrednie — co nie działa i jak to naprawić",
      sandwich: "Pełny obraz — co działa, co nie, konkretne poprawki",
      led_in: "Najpierw co jest dobrze, potem poprawki",
    },
  },
  t1_q10: {
    question: "Pytasz o coś technicznego co połowicznie znasz. AI używa żargonu vs codziennego języka. Twoja preferencja?",
    why_this_matters: "AI kalibruje słownictwo do Twojego poziomu.",
    options: {
      full_jargon: "Dawaj fachową terminologię — sam sprawdzę czego nie wiem",
      jargon_explained: "Używaj właściwych terminów ale wyjaśniaj niejasne",
      plain_language: "Prosty język — przetłumacz żargon",
      analogies: "Analogie i przykłady — zrób to konkretnym",
    },
  },
  t1_q11: {
    question: "AI rozwiązuje coś złożonego i wyjaśnia krok po kroku swoje rozumowanie. Ty...",
    why_this_matters: "Ustawia czy AI pokazuje swoją pracę czy tylko daje wynik.",
    options: {
      love_the_transparency: "Świetnie — chcę śledzić logikę, nie tylko wniosek",
      summary_only: "Pokaż mi wniosek — ukryj obliczenia",
      key_steps: "Pokaż kluczowe punkty decyzyjne, pomiń oczywiste",
      depends_stakes: "Przy ważnych decyzjach tak, przy szybkich nie",
    },
  },
  t1_q12: {
    question: "AI mówi 'To może zadziałać, ale nie jestem pewien' vs 'Zrób to.' Gdy odpowiedź jest niepewna, wolisz...",
    why_this_matters: "Określa jak AI komunikuje własną niepewność.",
    options: {
      always_hedge: "Zawsze zaznaczaj niepewność — wolę wiedzieć niż fałszywa pewność",
      confident_anyway: "Daj pewną odpowiedź nawet gdy niepewny — sam zweryfikuję",
      hedge_for_high_stakes: "Zaznaczaj tylko gdy stawka wysoka — niska stawka, po prostu odpowiadaj",
      give_options: "Nie hedguj — daj 2 opcje i pozwól wybrać",
    },
  },
  t1_q13: {
    question: "AI ma powiedzieć coś czego możesz nie chcieć usłyszeć. Wolisz żeby...",
    why_this_matters: "Kształtuje jak AI obsługuje trudne prawdy.",
    options: {
      straight_up: "Powiedział wprost. Bez owijania.",
      context_first: "Dał kontekst żebym zrozumiał DLACZEGO, potem werdykt",
      acknowledge_intent: "Najpierw uznał moje zamierzenie, potem rzeczywistość",
      with_path_forward: "Zaczął od problemu i od razu dał ścieżkę naprzód",
    },
  },
  t1_q14: {
    question: "Przełączasz się między językami w rozmowie? (np. piszesz po polsku ale wrzucasz angielskie terminy)",
    why_this_matters: "AI może odzwierciedlać Twój naturalny wielojęzyczny flow.",
    options: {
      yes_frequently: "Tak — naturalnie miksuję języki, AI powinno nadążać",
      yes_technical: "Czasami — głównie terminy techniczne zostają po angielsku",
      no_one_language: "Nie — trzymam się jednego języka na rozmowę",
    },
  },
  t1_q14a: {
    question: "Jakie języki zazwyczaj mieszasz?",
    placeholder: "np. polski + angielski, angielski + niemiecki...",
  },
  t1_q15: {
    question: "Dostajesz wiadomość: 'O jasne, to na pewno zadziała idealnie.' Twoje odczytanie?",
    why_this_matters: "Zapobiega sytuacjom gdy AI jest przypadkowo niezrozumiałe przez ton.",
    options: {
      catch_it: "Łapię od razu — sarkazm w tekście jest dla mnie oczywisty",
      usually_get_it: "Zazwyczaj łapię, ale czasem potrzebuję chwili",
      often_miss: "Szczerze? Czasem biorę dosłownie, szczególnie w tekście",
      hate_it: "Łapię, ale sarkazm w tekście irytuje — mów wprost",
    },
  },
  t1_q16: {
    question: "AI pamięta coś co powiedziałeś mimochodem 3 tygodnie temu. Czujesz...",
    why_this_matters: "Ustawia jak agresywnie AI łączy wątki z przeszłości.",
    options: {
      impressed: "Pod wrażeniem — dokładnie takiej ciągłości chcę",
      slightly_unsettled: "Trochę nieswojo — zapomniałem że to powiedziałem",
      depends_context: "Zależy co — trafne = super, losowe = dziwne",
      prefer_clean_slate: "Wolę czyste karty — nie gromadź moich danych",
    },
  },
  t1_q17: {
    question: "Tłumaczysz coś i AI wskakuje z odpowiedzią zanim skończysz — czujesz:",
    why_this_matters: "Kształtuje czy AI dokańcza Twoją myśl czy czeka na pełny kontekst.",
    options: {
      interrupted: "Irytacja — nie skończyłem. Daj mi dokończyć myśl.",
      efficient: "Ok — jeśli złapał sedno, oszczędność czasu",
      depends_accuracy: "Ok jeśli trafił, irytujące jeśli źle zrozumiał",
    },
  },
  t1_q18: {
    question: "Przeglądasz kod kogoś innego. Komentarze w kodzie — Twoja preferencja?",
    why_this_matters: "AI dopasuje filozofię dokumentacji do Twojej.",
    options: {
      self_documenting: "Czysty kod nie potrzebuje komentarzy — nazwy powinny wyjaśniać",
      explain_why: "Komentuj DLACZEGO nie CO — kod umiem czytać",
      thorough: "Dokładne komentarze — dobre przy onboardingu i dla przyszłego mnie",
      context_dependent: "Zależy od złożoności — oczywiste = nic, pokręcone = komentarz",
    },
  },

  // ─── Tier 2: Cognitive Profile ───
  t2_q01: {
    question: "Nowy gadżet — w pudełku brak instrukcji. Twój ruch?",
    why_this_matters: "AI strukturyzuje każde wyjaśnienie pod to jak Twój mózg wchłania nowe informacje.",
    options: {
      try_it_first: "Biorę do ręki i zaczynam klikać — ogarnę",
      quick_scan: "Szybki przegląd instrukcji, potem improwizuję",
      read_first: "Czytam instrukcję porządnie zanim czegokolwiek dotknę",
      watch_someone: "Szukam filmiku na YouTube — wizualny przewodnik",
    },
  },
  t2_q02: {
    question: "Duży zakup — nowy laptop, kurs, przeprowadzka. Twój naturalny proces?",
    why_this_matters: "AI wie czy dać Ci arkusz za/przeciw czy jasną rekomendację do zareagowania.",
    options: {
      gut_check: "Intuicja najpierw — potem szukam danych żeby potwierdzić lub podważyć",
      systematic: "Wypisuję wszystko, ważę za i przeciw, decyduję analitycznie",
      consult_others: "Gadam z kimś — myślę na głos",
      sleep_on_it: "Zostawiam do przespania — wracam po 24h z jasnością",
    },
  },
  t2_q02a: {
    question: "Kiedy utkniesz między dwoma opcjami, co przełamuje impas?",
    options: {
      ask_someone: "Ktoś zaufany daje swoją opinię",
      deadline: "Presja deadline'u — po prostu muszę zdecydować",
      coin_flip: "Rzucam monetą i sprawdzam jak się czuję z wynikiem",
      more_data: "Jeszcze jedna informacja przechyla szalę",
    },
  },
  t2_q03: {
    question: "Tłumaczysz grawitację 10-latkowi — zaczynasz naturalnie od...",
    why_this_matters: "AI wybiera odpowiednią wysokość wyjaśnień — widok z góry czy z poziomu gruntu.",
    options: {
      analogy: "Analogia — 'wyobraź sobie że Ziemia to kula na trampolinie'",
      question: "Pytanie — 'dlaczego myślisz że spadasz gdy skoczysz?'",
      experiment: "Upuść coś — pokaż, potem wyjaśnij",
      definition: "Zasada — 'grawitacja to siła między masami'",
    },
  },
  t2_q04: {
    question: "Czytasz długi artykuł. Twoje faktyczne podejście?",
    why_this_matters: "AI wie czy dać Ci ustrukturyzowany podział czy płynną narrację.",
    options: {
      start_to_finish: "Od początku do końca, słowo po słowie — przetwarzam liniowo",
      skim_then_dive: "Przeglądam nagłówki, potem wchodzę gdzie warto",
      highlight_and_notes: "Aktywnie — zaznaczam, notuję, łączę wątki na bieżąco",
      read_once_absorb: "Czytam raz i wchłaniam — nie wracam, syntezuję w locie",
    },
  },
  t2_q05: {
    question: "Wchodzisz do pokoju w którym byłeś. Ktoś przesunął jedną rzecz. Zauważasz?",
    why_this_matters: "AI kalibruje jak wyczerpujące być — każdy edge case czy tylko kluczowe.",
    options: {
      immediately: "Tak, od razu — coś jest nie tak zanim to nazwę",
      eventually: "Zazwyczaj — zauważę w ciągu minuty jeśli zwracam uwagę",
      rarely: "Raczej nie, chyba że oczywiste — skupiam się na całości",
      depends_interest: "Zależy czy mi zależy na tej przestrzeni — zainteresowanie steruje uwagą",
    },
  },
  t2_q06: {
    question: "Coś się psuje — crash apki, plan się sypie. Twój pierwszy instynkt?",
    why_this_matters: "AI adaptuje się: partner do pytań vs dostawca rozwiązań vs asystent researchu.",
    options: {
      diagnose_systematically: "Co się ostatnio zmieniło? Wracam systematycznie do przyczyny",
      try_things: "Zaczynam próbować poprawek — metoda prób szybsza od teorii",
      reframe: "Zoom out i kwestionuję ramę — może rozwiązuję zły problem",
      research_first: "Czas na research — ktoś to już rozwiązał",
    },
  },
  t2_q07: {
    question: "Ktoś tłumaczy bazy danych analogią do biblioteki. Twoja reakcja?",
    why_this_matters: "AI decyduje czy sięgać po analogię czy iść wprost do konceptu.",
    options: {
      clicks_immediately: "Łapie od razu — analogie to sposób w jaki buduję nowe modele",
      helpful_but_not_necessary: "Pomocne na start, ale muszę porzucić żeby naprawdę zrozumieć",
      prefer_technical: "Wolę definicję techniczną — analogie mogą mylić",
      depends_analogy: "Zależy od analogii — dobre pomagają, złe mylą",
    },
  },
  t2_q08: {
    question: "Jak wyobrażasz sobie coś złożonego — np. strukturę firmy lub codebase?",
    why_this_matters: "AI prezentuje złożone informacje w strukturze przestrzennej Twojego mózgu.",
    options: {
      visual_spatial: "Wizualnie — widzę boxy, przepływy, mapy. Narysowałbym żeby zrozumieć.",
      narrative: "Jako historię — kto robi co, co się dzieje, przyczyna i skutek",
      hierarchical: "Jako hierarchię — co jest na górze, co komu podlega",
      rules_principles: "Jako reguły i ograniczenia — co może a czego nie może się wydarzyć",
    },
  },
  t2_q09: {
    question: "AI rzuca 2000-słowną odpowiedź. Twoja szczera pierwsza reakcja?",
    why_this_matters: "AI szanuje Twoją faktyczną pojemność czytania.",
    options: {
      scan_for_answer: "Skanuję w poszukiwaniu kluczowego zdania i kończę",
      overwhelmed: "Przytłoczony — nie wchłonę tego i wiem to",
      read_if_needed: "Przeczytam jeśli temat wymaga — ogarniam głębię gdy ma sens",
      appreciate_depth: "Doceniam — wolę za dużo i przeskanować niż pytać jeszcze raz",
    },
  },
  t2_q10: {
    question: "Klient daje niejasny brief: 'Zrób żeby wyglądało premium.' Zero szczegółów. Ty:",
    why_this_matters: "AI wie czy działać z najlepszym strzałem czy potwierdzić interpretację.",
    options: {
      dive_in_interpret: "Wchodzę z moją interpretacją — łatwiej reagować na coś konkretnego",
      ask_one_question: "Jedno pytanie doprecyzowujące, potem działam",
      need_more_spec: "Nie mogę zacząć bez jaśniejszych wymagań — niejasne = zmarnowana praca",
      explore_with_options: "Robię 2-3 interpretacje i daję do wyboru",
    },
  },
  t2_q10a: {
    question: "Jaka minimalna specyfikacja żeby AI mogło ruszyć z niejasnym zadaniem?",
    options: {
      confirm_interpretation: "Przedstawi interpretację i poprosi o potwierdzenie",
      ask_one: "Zada jedno pytanie wyjaśniające",
      define_terms: "Zdefiniuje kluczowe terminy które zakłada",
    },
  },
  t2_q11: {
    question: "Znajomy mówi 'napisz życzenia dla Alka — krótko.' Ty...",
    why_this_matters: "AI uczy się czy dawać jedną mocną odpowiedź czy zakres do wyboru.",
    options: {
      one_solid: "Piszę jedne świetne — jeśli są dobre, po co opcje?",
      few_options: "Piszę 3 różne wersje żeby mógł wybrać klimat",
      ask_about_alex: "Pytam o Alka — generyczne życzenia to lenistwo",
      riff_freely: "Robię coś niestandardowego — zabawne, dziwne, pamiętne",
    },
  },
  t2_q12: {
    question: "Uświadamiasz sobie że przez lata myliłeś się w jakiejś kwestii. Twoja reakcja?",
    why_this_matters: "Kalibruje jak bezpośrednio AI może podważać Twoje przekonania.",
    options: {
      update_fast_curious: "Fascynujące — uwielbiam odkrywać że się myliłem. Dobra informacja.",
      update_uncomfortable: "Trochę nieswojo, ale aktualizuję — nie mogę celowo tkwić w błędzie",
      question_the_new: "Najpierw weryfikuję nową informację — może to ona jest błędna",
      bothers_me: "Gryzie mnie — zastanawiam się jak mogłem się tak pomylić",
    },
  },
  t2_q13: {
    question: "Siadasz do JEDNEJ ważnej rzeczy. Dwie godziny później...",
    why_this_matters: "AI formatuje zadania pod to jak Twoja uwaga faktycznie działa.",
    options: {
      done_or_deep: "Albo skończyłem albo jestem 3 poziomy głębiej — nic pomiędzy",
      steady_progress: "Stały, przewidywalny postęp — mniej więcej gdzie planowałem",
      several_tabs: "Jakoś jestem na innym temacie z 11 otwartymi kartami",
      partial_progress: "Częściowy postęp — robię do 70% i mentalnie przechodzę dalej",
    },
  },
  t2_q13a: {
    question: "Kiedy tak odpływasz — to przez zadanie czy mimo zadania?",
    options: {
      task_too_boring: "Zadanie było nudne — mózg znalazł coś ciekawszego",
      task_too_hard: "Zadanie trudne bez jasnego startu — odpłynięcie łatwiejsze",
      just_happens: "Po prostu się dzieje — nawet przy czymś co kocham",
    },
  },
  t2_q14: {
    question: "Jak się czujesz gdy AI nie zgadza się z Twoim wnioskiem?",
    why_this_matters: "Kalibruje jak AI reaguje gdy myśli że się mylisz.",
    options: {
      love_it: "Dawaj. Jeśli się mylę, chcę wiedzieć. Nie noś mnie na rękach.",
      welcome_if_earned: "Ok jeśli AI odrobiło lekcję — nie kontra dla zasady",
      depends_domain: "W mojej dziedzinie tak. Poza nią — jestem bardziej otwarty na prowadzenie.",
      softer_please: "Jestem otwarty, ale wolę niezgodę jako pytanie, nie korektę",
    },
  },
  t2_q15: {
    question: "Przy trudnym problemie — jaką rolę ma grać AI?",
    why_this_matters: "Ustawia domyślną dynamikę — myślicie razem czy AI odpowiada na pytania?",
    options: {
      rubber_duck: "Daj mi mówić — nie musisz odpowiadać, po prostu słuchaj",
      challenger: "Kwestionuj założenia — zadawaj pytania które robią dziury",
      solution_provider: "Po prostu daj odpowiedź — nie muszę myśleć na głos",
      structured_guide: "Poprowadź przez strukturę — pomóż myśleć krok po kroku",
    },
  },
  t2_q16: {
    question: "Jak komfortowo jest Ci z 'nie jestem pewien — rozkmińmy to razem'?",
    why_this_matters: "AI wie kiedy mówić 'pewnie' a kiedy dać jasną odpowiedź.",
    options: {
      love_it: "To mój preferowany tryb — eksploracja ważniejsza od pewności",
      fine_with_it: "Ok, dopóki robimy postęp i nie kręcimy się w kółko",
      makes_me_anxious: "Niekomfortowo — funkcjonuję lepiej z jasnymi odpowiedziami",
      domain_specific: "Zależy od stawki — niska = eksploruj, wysoka = potrzebuję kierunku",
    },
  },
  t2_q16a: {
    question: "Kiedy AI jest niepewne, co chcesz żeby zrobiło?",
    options: {
      best_guess: "Daj najlepszy strzał i oznacz jako niepewny",
      ask_clarifying: "Zadaj pytanie wyjaśniające żeby zmniejszyć niepewność",
      give_options: "Daj 2-3 opcje zależne od tego które założenie jest prawidłowe",
    },
  },

  // ─── Tier 3: Work ───
  t3_q01: {
    question: "Twój najbardziej produktywny dzień w zeszłym tygodniu — która opcja jest najbliżej?",
    options: {
      sprinter: "Zamknąłem się na 4h, rozjechałem ogromną rzecz, potem koniec",
      steady: "Stałe tempo cały dzień — bez wielkich wzlotów, solidny output",
      burst_rest: "90 minut on, przerwa, powtórz — rytm fokusowych serii",
      reactive: "Głównie reaktywny — robiłem co przyszło i robiłem to dobrze",
    },
  },
  t3_q02: {
    question: "Kiedy w ciągu dnia jesteś naprawdę najlepszy — najostrzejsze myślenie?",
    options: {
      early_morning: "Wczesny ranek (6-9) — mózg najczystszy zanim świat się obudzi",
      late_morning: "Przedpołudnie (9-12)",
      early_afternoon: "Wczesne popołudnie (12-15)",
      late_afternoon: "Późne popołudnie (15-18)",
      evening: "Wieczór (18-21) — kreatywność włącza się po pracy",
      night: "Noc (21+) — cisza, zero rozpraszaczy",
    },
  },

  // ─── Tier 7: Life Context ───
  t7_q01: {
    question: "Co najlepiej opisuje gdzie teraz jesteś w życiu?",
    options: {
      student_early: "Student lub początek kariery — buduję fundamenty",
      established_climbing: "Ustabilizowany i rosnący — wiem co robię, pcham dalej",
      pivot: "W przejściu — zmieniam kierunek, zaczynam coś nowego",
      building_business: "Buduję biznes lub idę na swoje — tryb przedsiębiorczy",
      senior_optimizing: "Senior — osiągnąłem, teraz optymalizuję",
      life_first: "Życie jest teraz ważniejsze — praca wspiera coś większego",
    },
  },
};

/**
 * Get translated question text for a given question ID and locale.
 * Returns undefined if no translation exists (fallback to original).
 */
export function getQuestionTranslation(questionId: string, locale: string): QuestionTranslation | undefined {
  if (locale === "pl") return pl[questionId];
  return undefined; // English = original
}

/**
 * Apply translations to a question object (mutates nothing, returns overrides).
 */
export function translateQuestion(
  questionId: string,
  locale: string,
  original: { question: string; placeholder?: string; why_this_matters?: string; options?: Array<{ value: string; label: string }> }
): typeof original {
  const trans = getQuestionTranslation(questionId, locale);
  if (!trans) return original;

  const result = { ...original };

  if (trans.question) result.question = trans.question;
  if (trans.placeholder) result.placeholder = trans.placeholder;
  if (trans.why_this_matters) result.why_this_matters = trans.why_this_matters;

  if (trans.options && result.options) {
    result.options = result.options.map(opt => ({
      ...opt,
      label: trans.options![opt.value] || opt.label,
    }));
  }

  return result;
}

const fs = require('fs');
const path = require('path');
const dbService = require('./services/dbService');
const { extractTextFromFile, cleanText } = require('./services/docParser');

async function populate() {
  await dbService.syncApuntesFolder();
  const topics = dbService.getAllTopics();
  console.log('Temas encontrados:', topics.map(t => t.title));

  const questionsByTopic = {
    'Jacob': [
      {
        question: "Cerca del final de su vida, ¿con qué dos palabras describió Jacob los años de su vida según Génesis 47:9?",
        options: {
          A: "Pocos y angustiosos (few and distressing)",
          B: "Prósperos y tranquilos (peaceful and wealthy)",
          C: "Gloriosos y victoriosos (victorious and holy)",
          D: "Lentos y amargos (slow and bitter)"
        },
        correctAnswer: "A",
        explanation: "En Génesis 47:9, Jacob eligió describir sus años de vida como 'pocos' y 'angustiosos' debido a las múltiples penurias y desafíos que afrontó."
      },
      {
        question: "¿Por qué razón tuvo que huir Jacob a la lejana tierra de Harán en su juventud?",
        options: {
          A: "Para escapar de una severa hambruna en Canaán",
          B: "Porque su hermano gemelo Esaú quería matarlo por la bendición paterna",
          C: "Para comerciar ganado con las tribus del este",
          D: "Porque fue desterrado por los ancianos de Berseba"
        },
        correctAnswer: "B",
        explanation: "Jacob tuvo que huir apresuradamente a Harán porque su hermano Esaú estaba convencido de que Jacob lo había estafado con la bendición y deseaba matarlo."
      },
      {
        question: "¿Quién advirtió a Jacob del peligro de muerte y le aconsejó huir de Esaú hacia Harán?",
        options: {
          A: "Su padre Isaac",
          B: "Su madre Rebeca",
          C: "Su abuelo Abrahán",
          D: "Su tío Labán"
        },
        correctAnswer: "B",
        explanation: "Su madre Rebeca se enteró de las intenciones homicidas de Esaú y advirtió de inmediato a Jacob para que huyera a la casa de su tío Labán."
      },
      {
        question: "En Harán, Jacob se enamoró de Raquel. ¿Qué engaño cometió su suegro Labán en la boda?",
        options: {
          A: "Le entregó a su hija mayor, Lea, en lugar de Raquel",
          B: "Le exigió el triple del salario pactado",
          C: "Huyó con todo el rebaño dejándolo sin dote",
          D: "Le obligó a casarse primero con una criada egipcia"
        },
        correctAnswer: "A",
        explanation: "Labán engañó a Jacob dándole en matrimonio a su hija mayor, Lea, lo que obligó a Jacob a trabajar otros siete años más para poder casarse también con Raquel."
      },
      {
        question: "Tras décadas de soportar los engaños de Labán en Harán, ¿qué instrucción directa le dio Jehová a Jacob?",
        options: {
          A: "Que marchara a Egipto para comprar trigo",
          B: "Que era hora de salir de Harán y regresar a su hogar en Canaán",
          C: "Que fundara una nueva ciudad cerca del río Éufrates",
          D: "Que se quedara en Harán hasta la muerte de Labán"
        },
        correctAnswer: "B",
        explanation: "Jehová se le apareció a Jacob y le indicó que había llegado el momento de dejar Harán y emprender el regreso a Canaán con toda su familia."
      },
      {
        question: "Cuando Labán persiguió y alcanzó a Jacob en su huida, ¿qué amenaza directa le profirió?",
        options: {
          A: "'Nunca podrás cruzar las fronteras de Canaán'",
          B: "'Está en mi poder hacerles daño'",
          C: "'Tus hijos pertenecerán para siempre a mi casa'",
          D: "'Exijo el doble de las ovejas manchadas'"
        },
        correctAnswer: "B",
        explanation: "Labán le dijo amenazadoramente: 'Está en mi poder hacerles daño', pero Jacob le recordó con firmeza los años de trato injusto y buscaron la paz."
      },
      {
        question: "Cuando Jacob regresaba a Canaán, ¿con cuántos hombres avanzaba Esaú a su encuentro, causándole gran temor?",
        options: {
          A: "100 hombres",
          B: "400 hombres",
          C: "300 soldados escogidos",
          D: "1000 guerreros edomitas"
        },
        correctAnswer: "B",
        explanation: "A Jacob se le informó que Esaú venía hacia él al frente de 400 hombres, por lo que Jacob se sintió muy atemorizado y angustiado."
      },
      {
        question: "¿Qué estrategia puso en práctica Jacob para intentar apaciguar el enojo de su hermano Esaú?",
        options: {
          A: "Construyó una fortaleza de piedra en el vado de Jaboc",
          B: "Envió siervos por delante con valiosos regalos de ganado para Esaú",
          C: "Pactó una alianza militar con los reyes amorreos",
          D: "Se escondió con su familia en las cuevas de Seír"
        },
        correctAnswer: "B",
        explanation: "Jacob preparó cuantiosos lotes de animales como regalos y los envió por delante en manos de sus siervos con la esperanza de apaciguar a Esaú."
      },
      {
        question: "En las horas previas al amanecer antes de encontrarse con Esaú, ¿con quién luchó Jacob cuerpo a cuerpo?",
        options: {
          A: "Con un espía enviado por Esaú",
          B: "Con un ángel de Jehová",
          C: "Con un bandido del vado de Jaboc",
          D: "Con su suegro Labán"
        },
        correctAnswer: "B",
        explanation: "Un ángel de Jehová se le apareció a Jacob en la oscuridad y luchó con él cuerpo a cuerpo durante horas porque Jacob buscaba con fervor su bendición."
      },
      {
        question: "¿Cuántos años de edad tenía aproximadamente Jacob cuando sostuvo la intensa lucha con el ángel?",
        options: {
          A: "45 años",
          B: "97 años",
          C: "70 años",
          D: "120 años"
        },
        correctAnswer: "B",
        explanation: "Jacob tenía ya 97 años de edad cuando sostuvo aquella agotadora lucha física con el ángel, demostrando una fe y determinación extraordinarias."
      },
      {
        question: "Según el libro profético de Oseas 12:4, ¿qué detalle conmovedor acompañó la lucha de Jacob por conseguir la bendición?",
        options: {
          A: "Luchó e incluso lloró suplicando favor",
          B: "Ofreció un sacrificio de siete carneros",
          C: "Ayunó durante tres días continuos",
          D: "Invocó los nombres de Abrahán e Isaac siete veces"
        },
        correctAnswer: "A",
        explanation: "Oseas 12:4 destaca que Jacob 'siguió contendiendo con un ángel y poco a poco prevaleció; lloró y le rogó que le mostrara favor'."
      },
      {
        question: "¿Qué lesión física le provocó el ángel a Jacob con un simple toque al rayar el alba?",
        options: {
          A: "Le fracturó el brazo derecho",
          B: "Le dislocó la cavidad de la articulación de la cadera (hip socket)",
          C: "Le paralizó el talón izquierdo",
          D: "Le dañó los ligamentos de la rodilla"
        },
        correctAnswer: "B",
        explanation: "Con un mero toque, el ángel zafó la articulación de la cadera de Jacob, dejándolo con una cojera permanente por el resto de sus días."
      },
      {
        question: "¿Qué nuevo nombre le otorgó el ángel a Jacob y qué significado tiene?",
        options: {
          A: "Israel, que significa 'El que contiende o persevera con Dios'",
          B: "Judá, que significa 'Alabado sea Jehová'",
          C: "Josué, que significa 'Jehová es salvación'",
          D: "Benjamín, que significa 'Hijo de la diestra'"
        },
        correctAnswer: "A",
        explanation: "El ángel le dijo: 'Tu nombre ya no será Jacob, sino Israel, porque has contendido con Dios y con hombres y por fin prevaleciste'."
      },
      {
        question: "¿Cómo se presentó Jacob ante Esaú al momento del reencuentro en el camino?",
        options: {
          A: "Fue adelante solo y se inclinó hasta el suelo siete veces",
          B: "Envió a Raquel y a José al frente como embajadores",
          C: "Avanzó a caballo con su espada en alto",
          D: "Esperó de pie en el campamento mientras sus siervos negociaban"
        },
        correctAnswer: "A",
        explanation: "Jacob tomó la iniciativa valientemente, marchó al frente de todos y se postró humildemente en tierra siete veces mientras se acercaba a su hermano."
      },
      {
        question: "¿Cuál fue la conmovedora reacción de Esaú cuando llegó ante Jacob?",
        options: {
          A: "Le exigió la mitad de sus rebaños antes de perdonarlo",
          B: "No sacó armas; corrió a su encuentro, lo abrazó por el cuello y ambos lloraron",
          C: "Lo rechazó fríamente y regresó a Seír sin hablarle",
          D: "Aceptó sus regalos pero se negó a abrazarlo"
        },
        correctAnswer: "B",
        explanation: "La humildad y generosidad de Jacob desarmaron por completo a Esaú: corrió hacia él, lo abrazó cálidamente y los dos hermanos lloraron juntos reconciliados."
      },
      {
        question: "Según Génesis 28:14, ¿qué gran promesa de Jehová se cumplió a través de Jacob?",
        options: {
          A: "Que su descendencia sería como el polvo de la tierra y todas las familias serían bendecidas",
          B: "Que gobernaría sobre todo Egipto como faraón",
          C: "Que sus rebaños nunca sufrirían enfermedad",
          D: "Que viviría más años que Matusalén"
        },
        correctAnswer: "A",
        explanation: "Jehová prometió a Jacob en Betel que su descendencia se esparciría a los cuatro puntos cardinales y por medio de ella se bendecirían todas las familias del suelo."
      },
      {
        question: "En las Escrituras, ¿con qué título honorable se llama frecuentemente a Jehová (Éxodo 3:6)?",
        options: {
          A: "El Dios de Jacob (y de Abrahán y de Isaac)",
          B: "El Rey de Harán",
          C: "El Dios de los montes amorreos",
          D: "El Protector de Canaán"
        },
        correctAnswer: "A",
        explanation: "En Éxodo 3:6 Jehová se identificó ante Moisés diciendo: 'Yo soy el Dios de tu padre, el Dios de Abrahán, el Dios de Isaac y el Dios de Jacob'."
      },
      {
        question: "¿En qué evangelio citó Jesús la frase 'el Dios de Jacob' para demostrar la resurrección de los muertos?",
        options: {
          A: "Marcos 5:12",
          B: "Lucas 20:37, 38",
          C: "Juan 3:16",
          D: "Mateo 10:28"
        },
        correctAnswer: "B",
        explanation: "Jesús citó este título en Lucas 20:37, 38 explicando que Jehová 'no es Dios de muertos, sino de vivos, porque para él todos ellos viven'."
      },
      {
        question: "¿Qué capítulos del libro de Génesis recogen los relatos analizados sobre la vida, luchas y reconciliación de Jacob?",
        options: {
          A: "Génesis 1 al 11",
          B: "Génesis 27:41-45; 31:1-29, 36-55; 32:1 a 33:16",
          C: "Génesis 45 al 50 únicamente",
          D: "Génesis 12 al 22"
        },
        correctAnswer: "B",
        explanation: "Estos episodios se narran detalladamente en Génesis 27:41-45 (amenaza de Esaú), Génesis 31 (salida de Harán), y Génesis 32-33 (lucha con el ángel y reconciliación)."
      },
      {
        question: "¿Qué lección primordial resalta la vida de Jacob para los siervos de Dios hoy?",
        options: {
          A: "Que el éxito material depende de la astucia comercial",
          B: "Que la fe, la determinación y la perseverancia por obtener la bendición de Jehová valen cualquier esfuerzo",
          C: "Que es mejor resolver disputas mediante confrontación armada",
          D: "Que los problemas familiares nunca tienen solución pacífica"
        },
        correctAnswer: "B",
        explanation: "Jacob demostró un aprecio inquebrantable por las cosas sagradas, esforzándose tenazmente por la bendición de Jehová y buscando la paz con humildad."
      }
    ],

    'Books of the Bible': [
      {
        question: "¿Quién fue el escritor del libro de Génesis y en qué lugar se completó?",
        options: {
          A: "Josué, en Canaán",
          B: "Moisés, en el desierto (Wilderness)",
          C: "Samuel, en Siló",
          D: "Esdras, en Jerusalén"
        },
        correctAnswer: "B",
        explanation: "Según los apuntes, el libro de Génesis fue escrito por Moisés en el desierto (Wilderness) y terminado en el año 1513 a.C."
      },
      {
        question: "¿En qué año se completó la escritura del libro de Génesis y qué tiempo abarca?",
        options: {
          A: "1513 a.C., abarcando desde 'En el principio' hasta 1657 a.C.",
          B: "1473 a.C., abarcando 40 años en el desierto",
          C: "1077 a.C., abarcando la época de los jueces",
          D: "580 a.C., abarcando desde Adán hasta el cautiverio"
        },
        correctAnswer: "A",
        explanation: "Génesis se terminó en 1513 a.C. y abarca desde la creación ('En el principio') hasta la muerte de José en 1657 a.C."
      },
      {
        question: "¿En qué año completó Moisés la redacción de los libros de Éxodo y Levítico?",
        options: {
          A: "1513 a.C.",
          B: "1512 a.C.",
          C: "1473 a.C.",
          D: "1450 a.C."
        },
        correctAnswer: "B",
        explanation: "Tanto Éxodo como Levítico fueron completados por Moisés en el desierto en el año 1512 a.C."
      },
      {
        question: "¿Cuánto tiempo abarca el contenido histórico del libro de Levítico?",
        options: {
          A: "1 mes (en 1512 a.C.)",
          B: "1 año completo",
          C: "40 años de travesía",
          D: "7 años de conquista"
        },
        correctAnswer: "A",
        explanation: "Levítico abarca exactamente 1 mes en el año 1512 a.C., entre la erección del tabernáculo y la cuenta del pueblo en Números."
      },
      {
        question: "¿Dónde completó Moisés la escritura de Números y Deuteronomio en el año 1473 a.C.?",
        options: {
          A: "En el monte Sinaí",
          B: "En el desierto y las llanuras de Moab (Plains of Moab)",
          C: "En la ciudad de Hebrón",
          D: "En Egipto antes del éxodo"
        },
        correctAnswer: "B",
        explanation: "Números y Deuteronomio fueron completados en 1473 a.C. en las llanuras de Moab, justo antes de cruzar el Jordán hacia Canaán."
      },
      {
        question: "¿Quién escribió el libro de Josué y qué período histórico abarca?",
        options: {
          A: "Josué; abarca de 1473 a c. 1450 a.C. (escrito en Canaán)",
          B: "Caleb; abarca de 1512 a 1473 a.C.",
          C: "Eleazar; abarca la época de los jueces",
          D: "Finehás; abarca la división tribal en Siló"
        },
        correctAnswer: "A",
        explanation: "El libro de Josué fue escrito por Josué en Canaán y concluido alrededor de 1450 a.C., abarcando desde 1473 hasta c. 1450 a.C."
      },
      {
        question: "¿Quién escribió los libros bíblicos de Jueces y Rut?",
        options: {
          A: "El rey David",
          B: "El profeta Samuel",
          C: "El sacerdote Elí",
          D: "El rey Salomón"
        },
        correctAnswer: "B",
        explanation: "Los libros de Jueces (c. 1100 a.C.) y Rut (c. 1090 a.C.) fueron escritos por el profeta Samuel en Israel."
      },
      {
        question: "¿Quiénes fueron los tres escritores que colaboraron en la redacción de 1 Samuel?",
        options: {
          A: "Samuel, Gad y Natán",
          B: "David, Salomón y Asaf",
          C: "Moisés, Josué y Finehás",
          D: "Esdras, Nehemías y Malaquías"
        },
        correctAnswer: "A",
        explanation: "1 Samuel fue completado hacia 1078 a.C. y en su redacción participaron Samuel, Gad y Natán."
      },
      {
        question: "¿Quiénes escribieron el libro de 2 Samuel alrededor del año 1040 a.C.?",
        options: {
          A: "Samuel solo",
          B: "Gad y Natán",
          C: "El rey David",
          D: "Jeremías"
        },
        correctAnswer: "B",
        explanation: "Dado que Samuel había muerto antes, 2 Samuel fue redactado por los profetas Gad y Natán hacia 1040 a.C."
      },
      {
        question: "¿Quién escribió los libros de 1 Reyes y 2 Reyes, terminados en el año 580 a.C.?",
        options: {
          A: "El profeta Jeremías",
          B: "El sacerdote Esdras",
          C: "El rey Ezequías",
          D: "El profeta Isaías"
        },
        correctAnswer: "A",
        explanation: "1 y 2 Reyes fueron completados en 580 a.C. por el profeta Jeremías en Judá y Egipto."
      },
      {
        question: "¿Quién escribió 1 y 2 Crónicas y el libro de Esdras alrededor del año 460 a.C.?",
        options: {
          A: "Nehemías",
          B: "Esdras",
          C: "Zacarías",
          D: "Mardoqueo"
        },
        correctAnswer: "B",
        explanation: "Esdras escribió 1 Crónicas, 2 Crónicas y el libro de Esdras en Jerusalén alrededor de 460 a.C."
      },
      {
        question: "¿Quién escribió el libro de Nehemías y aproximadamente en qué fecha?",
        options: {
          A: "Nehemías, después del 443 a.C. en Jerusalén",
          B: "Esdras, en el 537 a.C.",
          C: "Zorobabel, en el 515 a.C.",
          D: "Malaquías, en el 400 a.C."
        },
        correctAnswer: "A",
        explanation: "El libro de Nehemías fue escrito por Nehemías en Jerusalén después del 443 a.C."
      },
      {
        question: "¿Quién escribió el libro de Ester y en qué ciudad imperial se redactó hacia 475 a.C.?",
        options: {
          A: "Daniel, en Babilonia",
          B: "Mardoqueo, en Susa (Shushan, Elam)",
          C: "Nehemías, en Jerusalén",
          D: "Esdras, en Ecbatana"
        },
        correctAnswer: "B",
        explanation: "El libro de Ester fue escrito por Mardoqueo en el palacio real de Susa (Shushan, Elam) hacia 475 a.C."
      },
      {
        question: "¿Quién escribió el libro de Job y qué tiempo abarca la narración?",
        options: {
          A: "Moisés en el desierto (c. 1473 a.C.); abarca más de 140 años entre 1657 y 1473 a.C.",
          B: "Elifaz en Temán; abarca 10 años",
          C: "Salomón en Jerusalén; abarca 50 años",
          D: "David en Judá; abarca la época de los jueces"
        },
        correctAnswer: "A",
        explanation: "El libro de Job fue escrito por Moisés en el desierto hacia 1473 a.C. y abarca más de 140 años entre la muerte de José y la época de Moisés."
      },
      {
        question: "¿Quiénes son los tres escritores que aportaron proverbios en el libro de Proverbios?",
        options: {
          A: "David, Asaf y Hemán",
          B: "Salomón, Agur y Lemuel",
          C: "Moisés, Josué y Caleb",
          D: "Isaías, Jeremías y Ezequiel"
        },
        correctAnswer: "B",
        explanation: "Proverbios contiene dichos del rey Salomón, de Agur y del rey Lemuel (terminado de compilar hacia 717 a.C.)."
      },
      {
        question: "¿Quién escribió los libros de Eclesiastés y El Cantar de los Cantares en Jerusalén?",
        options: {
          A: "El rey David",
          B: "El rey Salomón",
          C: "El profeta Isaías",
          D: "El rey Josías"
        },
        correctAnswer: "B",
        explanation: "Ambos libros sapienciales fueron redactados por el sabio rey Salomón en Jerusalén."
      },
      {
        question: "¿Quién escribió Lamentaciones en el año 607 a.C. y en qué lugar?",
        options: {
          A: "Ezequiel, junto al río Quebar",
          B: "Jeremías, cerca de Jerusalén",
          C: "Baruc, en Babilonia",
          D: "Daniel, en el palacio caldeo"
        },
        correctAnswer: "B",
        explanation: "Jeremías escribió Lamentaciones en 607 a.C. cerca de las ruinas humeantes de Jerusalén."
      },
      {
        question: "¿Qué profeta escribió el libro que lleva su nombre concluido después de 732 a.C.?",
        options: {
          A: "Isaías, en Jerusalén",
          B: "Amós, en Betel",
          C: "Oseas, en Samaria",
          D: "Miqueas, en Moréset"
        },
        correctAnswer: "A",
        explanation: "El libro de Isaías fue terminado por el profeta Isaías en Jerusalén después del año 732 a.C."
      },
      {
        question: "¿Qué dos lugares figuran como los sitios de redacción de los libros de Jeremías y 2 Reyes?",
        options: {
          A: "Galilea y Samaria",
          B: "Judá y Egipto",
          C: "Babilonia y Persia",
          D: "Moab y Edom"
        },
        correctAnswer: "B",
        explanation: "Jeremías escribió en Judá y posteriormente en Egipto, adonde fue llevado por los fugitivos judíos."
      },
      {
        question: "¿En qué año se completó el libro de Salmos, que compila cánticos de David y otros compositores?",
        options: {
          A: "c. 460 a.C.",
          B: "c. 1000 a.C.",
          C: "c. 717 a.C.",
          D: "c. 1473 a.C."
        },
        correctAnswer: "A",
        explanation: "La recopilación final del libro de Salmos se completó alrededor del año 460 a.C., probablemente en tiempos de Esdras."
      }
    ],

    'Kings of Juda and Israel': [
      {
        question: "¿Quién fue el primer rey del reino norteño de diez tribus de Israel tras la división en 997 a.C.?",
        options: {
          A: "Jeroboam (reinó 22 años)",
          B: "Roboam (reinó 17 años)",
          C: "Baasa (reinó 24 años)",
          D: "Acab (reinó 22 años)"
        },
        correctAnswer: "A",
        explanation: "Jeroboam fue el primer monarca del reino del norte y gobernó durante 22 años (997 - c. 976 a.C.)."
      },
      {
        question: "¿Quién fue el primer rey del reino sureño de dos tribus de Judá tras la división?",
        options: {
          A: "Roboam (reinó 17 años)",
          B: "Asá (reinó 41 años)",
          C: "Abías (reinó 3 años)",
          D: "Josafat (reinó 25 años)"
        },
        correctAnswer: "A",
        explanation: "Roboam, hijo de Salomón, reinó 17 años en Jerusalén sobre el reino de dos tribus de Judá (997 - 980 a.C.)."
      },
      {
        question: "¿Qué rey de Israel gobernó durante el período más breve de toda la monarquía, reinando tan solo 7 días?",
        options: {
          A: "Zimri (c. 951 a.C.)",
          B: "Nadab",
          C: "Elah",
          D: "Salum"
        },
        correctAnswer: "A",
        explanation: "Zimri reinó solamente 7 días en Tirzá en c. 951 a.C. antes de perecer en el palacio incendiado."
      },
      {
        question: "¿Qué rey de Judá gobernó con fidelidad durante 41 años (978 - 937 a.C.)?",
        options: {
          A: "Asá",
          B: "Abías",
          C: "Joram",
          D: "Acaz"
        },
        correctAnswer: "A",
        explanation: "El rey Asá reinó 41 años en Judá y promovió una decidida campaña contra la idolatría."
      },
      {
        question: "¿Qué rey de Israel reinó 22 años y estuvo casado con la malvada princesa fenicia Jezabel?",
        options: {
          A: "Acab (c. 940 - c. 920 a.C.)",
          B: "Omrí",
          C: "Jeroboam II",
          D: "Jehú"
        },
        correctAnswer: "A",
        explanation: "Acab reinó 22 años en Samaria y fomentó el culto a Baal promovido por su esposa Jezabel."
      },
      {
        question: "¿Qué rey y comandante de Israel ejecutó el juicio divino contra la casa de Acab y reinó durante 28 años?",
        options: {
          A: "Jehú (c. 905 - 876 a.C.)",
          B: "Joacaz",
          C: "Péqaj",
          D: "Menajem"
        },
        correctAnswer: "A",
        explanation: "Jehú fue ungido para exterminar la casa de Acab y erradicar el baalismo, reinando 28 años en Israel."
      },
      {
        question: "¿Cuál fue la única mujer que usurpó el trono de Judá y reinó durante 6 años (c. 905 - 898 a.C.)?",
        options: {
          A: "La reina Atalía",
          B: "Jezabel",
          C: "Mical",
          D: "Betsabé"
        },
        correctAnswer: "A",
        explanation: "Atalía, hija de Acab y Jezabel, asesinó a la descendencia real y usurpó el trono de Judá durante 6 años."
      },
      {
        question: "¿Durante el reinado de qué reyes de Israel estuvo activo principalmente el profeta Elías?",
        options: {
          A: "Acab y Ocozías (Ahaziah)",
          B: "Jeroboam y Nadab",
          C: "Jehú y Joacaz",
          D: "Péqaj y Oseas"
        },
        correctAnswer: "A",
        explanation: "Elías profetizó con gran poder durante los reinados de Acab y de su hijo Ocozías en el reino norteño."
      },
      {
        question: "¿Quién fue el sucesor de Elías como profeta principal en Israel, activo durante Jehoram, Jehú, Joacaz y Jehoás?",
        options: {
          A: "Eliseo (c. 917 - c. 859 a.C.)",
          B: "Jonás",
          C: "Amós",
          D: "Miqueas"
        },
        correctAnswer: "A",
        explanation: "Eliseo sucedió a Elías y realizó numerosos milagros a lo largo de más de 50 años de ministerio profético."
      },
      {
        question: "¿Qué rey de Israel tuvo un largo reinado de 41 años en el siglo IX a.C., durante el cual profetizaron Jonás y Amós?",
        options: {
          A: "Jeroboam II (c. 844 - c. 803 a.C.)",
          B: "Jehoás",
          C: "Baasa",
          D: "Menajem"
        },
        correctAnswer: "A",
        explanation: "Jeroboam II reinó 41 años y recuperó territorios de Israel según la profecía anunciada por Jonás."
      },
      {
        question: "¿Qué rey de Judá reinó durante 52 años en Jerusalén hasta enfermar de lepra?",
        options: {
          A: "Uzías (Azarías)",
          B: "Jotán",
          C: "Ezequías",
          D: "Josías"
        },
        correctAnswer: "A",
        explanation: "Uzías (Azarías) reinó 52 años (829 - 777 a.C.), prosperó militarmente pero fue herido de lepra por su altivez en el templo."
      },
      {
        question: "¿En qué año cayó Samaria ante el imperio asirio, marcando el fin definitivo del reino de diez tribus de Israel?",
        options: {
          A: "740 a.C.",
          B: "607 a.C.",
          C: "997 a.C.",
          D: "586 a.C."
        },
        correctAnswer: "A",
        explanation: "En 740 a.C., los asirios conquistaron Samaria bajo el reinado de Oseas (Hoshea), poniendo fin al reino de Israel."
      },
      {
        question: "¿Quién fue el último rey del reino del norte de diez tribus de Israel antes de su caída?",
        options: {
          A: "Oseas (Hoshea, reinó 9 años)",
          B: "Péqaj",
          C: "Pecajías",
          D: "Zacarías"
        },
        correctAnswer: "A",
        explanation: "Oseas (Hoshea) fue el último monarca israelita que reinó en Samaria antes de la conquista asiria de 740 a.C."
      },
      {
        question: "¿Qué rey de Judá tuvo el reinado más prolongado en la historia de Jerusalén, gobernando durante 55 años?",
        options: {
          A: "Manasés (716 - 661 a.C.)",
          B: "Ezequías",
          C: "Josías",
          D: "Roboam"
        },
        correctAnswer: "A",
        explanation: "Manasés reinó durante 55 años en Jerusalén; derramó mucha sangre inocente pero con el tiempo se humilló y arrepintió."
      },
      {
        question: "¿Qué fiel rey de Judá presenció la milagrosa destrucción del ejército asirio de Senaquerib y reinó 29 años?",
        options: {
          A: "Ezequías (Hezekiah)",
          B: "Acaz",
          C: "Jotán",
          D: "Amón"
        },
        correctAnswer: "A",
        explanation: "Ezequías reinó 29 años (746 - 716 a.C.), restableció la adoración verdadera y confió plenamente en Jehová frente a Senaquerib."
      },
      {
        question: "¿Qué joven rey de Judá ascendió al trono a los 8 años y promovió una de las reformas espirituales más grandes (reinó 31 años)?",
        options: {
          A: "Josías (Josiah, 659 - 628 a.C.)",
          B: "Joacaz",
          C: "Joaquín",
          D: "Sedequías"
        },
        correctAnswer: "A",
        explanation: "El piadoso rey Josías reinó 31 años, reparó el templo, redescubrió el libro de la Ley y limpió la tierra de idolatría."
      },
      {
        question: "¿En qué año histórico fue destruida Jerusalén y su templo por las fuerzas babilonias de Nabucodonosor?",
        options: {
          A: "607 a.C.",
          B: "740 a.C.",
          C: "537 a.C.",
          D: "455 a.C."
        },
        correctAnswer: "A",
        explanation: "En 607 a.C., los ejércitos babilonios incendiaron Jerusalén, derribaron el templo de Salomón y llevaron a los judíos cautivos."
      },
      {
        question: "¿Quién fue el último rey que se sentó en el trono de David en Jerusalén antes de la desolación de 607 a.C.?",
        options: {
          A: "Sedequías (Zedekiah, reinó 11 años)",
          B: "Jehoiaquim",
          C: "Jehoiachin",
          D: "Joacaz"
        },
        correctAnswer: "A",
        explanation: "Sedequías fue el último monarca judío; fue capturado, cegado y llevado a Babilonia tras 11 años de reinado."
      },
      {
        question: "¿Qué profeta advirtió incansablemente a los reyes de Judá y presenció la caída y destrucción de Jerusalén en 607 a.C.?",
        options: {
          A: "El profeta Jeremías",
          B: "El profeta Jonás",
          C: "El profeta Oseas",
          D: "El profeta Elías"
        },
        correctAnswer: "A",
        explanation: "Jeremías profetizó desde 647 hasta después de 580 a.C., aconsejando a los últimos reyes y lamentando la caída de la ciudad santa."
      },
      {
        question: "¿Qué dos célebres profetas sirvieron entre los cautivos desterrados en Babilonia durante y después de la caída de Jerusalén?",
        options: {
          A: "Daniel y Ezequiel",
          B: "Amós y Oseas",
          C: "Elías y Eliseo",
          D: "Nahúm y Habacuc"
        },
        correctAnswer: "A",
        explanation: "Daniel (en la corte imperial) y Ezequiel (junto a los desterrados en Tel-abib) profetizaron en Babilonia fortaleciendo la fe del pueblo."
      }
    ]
  };

  let totalAdded = 0;
  for (const topic of topics) {
    let qList = null;
    if (topic.title.toLowerCase().includes('jacob')) {
      qList = questionsByTopic['Jacob'];
    } else if (topic.title.toLowerCase().includes('books') || topic.title.toLowerCase().includes('bible')) {
      qList = questionsByTopic['Books of the Bible'];
    } else if (topic.title.toLowerCase().includes('kings') || topic.title.toLowerCase().includes('juda')) {
      qList = questionsByTopic['Kings of Juda and Israel'];
    }

    if (qList && qList.length > 0) {
      console.log(`Guardando ${qList.length} preguntas ricas en datos para tema: "${topic.title}"...`);
      const saved = dbService.addQuestionsToTopic(topic.id, qList);
      totalAdded += saved.length;
    }
  }

  console.log('--- RESUMEN FINAL ---');
  console.log('Total de preguntas guardadas en la BD:', totalAdded);
  const updated = dbService.getAllTopics();
  console.log(updated.map(t => ({ title: t.title, questionsCount: t.questionsCount })));
}

populate().catch(err => console.error(err));

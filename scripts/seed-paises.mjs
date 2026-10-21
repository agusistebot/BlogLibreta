// Genera data/paises.json con TODOS los países (miembros de la ONU + algunos territorios
// con tránsito turístico relevante). Se ejecuta una sola vez: si el archivo ya existe,
// no lo pisa salvo que se pase --force. Las fichas se completan luego, de a 10 por semana,
// con scripts/update.mjs.
//
// Estado inicial de las convenciones: listas de partes de la Convención de Ginebra (1949)
// y de Viena (1968) según la Colección de Tratados de la ONU (vía Wikipedia, marzo 2025).
// La actualización semanal vuelve a verificar cada país contra fuentes oficiales.

import { existsSync } from 'node:fs';
import { writeJSON, slugify, hoyISO } from './lib/util.mjs';
import { DATA } from './lib/config.mjs';

// ISO2 | nombre en español | nombre en inglés (para cruzar con listas de la ONU) | región | prioridad
const TABLA = `
AF|Afganistán|Afghanistan|Asia|0
AL|Albania|Albania|Europa|0
DE|Alemania|Germany|Europa|85
AD|Andorra|Andorra|Europa|20
AO|Angola|Angola|África|0
AG|Antigua y Barbuda|Antigua and Barbuda|América Central y Caribe|10
SA|Arabia Saudita|Saudi Arabia|Medio Oriente|20
DZ|Argelia|Algeria|África|0
AR|Argentina|Argentina|América del Sur|99
AM|Armenia|Armenia|Asia|0
AU|Australia|Australia|Oceanía|80
AT|Austria|Austria|Europa|70
AZ|Azerbaiyán|Azerbaijan|Asia|0
BS|Bahamas|Bahamas|América Central y Caribe|20
BD|Bangladés|Bangladesh|Asia|0
BB|Barbados|Barbados|América Central y Caribe|10
BH|Baréin|Bahrain|Medio Oriente|0
BE|Bélgica|Belgium|Europa|65
BZ|Belice|Belize|América Central y Caribe|20
BJ|Benín|Benin|África|0
BY|Bielorrusia|Belarus|Europa|0
BO|Bolivia|Bolivia|América del Sur|80
BA|Bosnia y Herzegovina|Bosnia and Herzegovina|Europa|10
BW|Botsuana|Botswana|África|10
BR|Brasil|Brazil|América del Sur|100
BN|Brunéi|Brunei|Asia|0
BG|Bulgaria|Bulgaria|Europa|20
BF|Burkina Faso|Burkina Faso|África|0
BI|Burundi|Burundi|África|0
BT|Bután|Bhutan|Asia|0
CV|Cabo Verde|Cabo Verde|África|0
KH|Camboya|Cambodia|Asia|10
CM|Camerún|Cameroon|África|0
CA|Canadá|Canada|América del Norte|82
QA|Catar|Qatar|Medio Oriente|20
TD|Chad|Chad|África|0
CL|Chile|Chile|América del Sur|98
CN|China|China|Asia|30
CY|Chipre|Cyprus|Europa|20
VA|Ciudad del Vaticano|Holy See|Europa|5
CO|Colombia|Colombia|América del Sur|84
KM|Comoras|Comoros|África|0
CG|Congo|Congo|África|0
KP|Corea del Norte|North Korea|Asia|0
KR|Corea del Sur|South Korea|Asia|40
CI|Costa de Marfil|Côte d'Ivoire|África|0
CR|Costa Rica|Costa Rica|América Central y Caribe|80
HR|Croacia|Croatia|Europa|72
CU|Cuba|Cuba|América Central y Caribe|75
DK|Dinamarca|Denmark|Europa|50
DM|Dominica|Dominica|América Central y Caribe|5
EC|Ecuador|Ecuador|América del Sur|78
EG|Egipto|Egypt|África|40
SV|El Salvador|El Salvador|América Central y Caribe|40
AE|Emiratos Árabes Unidos|United Arab Emirates|Medio Oriente|70
ER|Eritrea|Eritrea|África|0
SK|Eslovaquia|Slovakia|Europa|20
SI|Eslovenia|Slovenia|Europa|40
ES|España|Spain|Europa|97
US|Estados Unidos|United States|América del Norte|96
EE|Estonia|Estonia|Europa|20
SZ|Esuatini|Eswatini|África|0
ET|Etiopía|Ethiopia|África|0
PH|Filipinas|Philippines|Asia|30
FI|Finlandia|Finland|Europa|40
FJ|Fiyi|Fiji|Oceanía|10
FR|Francia|France|Europa|94
GA|Gabón|Gabon|África|0
GM|Gambia|Gambia|África|0
GE|Georgia|Georgia|Asia|10
GH|Ghana|Ghana|África|0
GD|Granada|Grenada|América Central y Caribe|5
GR|Grecia|Greece|Europa|78
GT|Guatemala|Guatemala|América Central y Caribe|50
GN|Guinea|Guinea|África|0
GQ|Guinea Ecuatorial|Equatorial Guinea|África|5
GW|Guinea-Bisáu|Guinea-Bissau|África|0
GY|Guyana|Guyana|América del Sur|10
HT|Haití|Haiti|América Central y Caribe|5
HN|Honduras|Honduras|América Central y Caribe|40
HK|Hong Kong|Hong Kong|Asia|20
HU|Hungría|Hungary|Europa|30
IN|India|India|Asia|30
ID|Indonesia|Indonesia|Asia|40
IQ|Irak|Iraq|Medio Oriente|0
IR|Irán|Iran|Medio Oriente|0
IE|Irlanda|Ireland|Europa|72
IS|Islandia|Iceland|Europa|75
MH|Islas Marshall|Marshall Islands|Oceanía|0
SB|Islas Salomón|Solomon Islands|Oceanía|0
IL|Israel|Israel|Medio Oriente|65
IT|Italia|Italy|Europa|95
JM|Jamaica|Jamaica|América Central y Caribe|20
JP|Japón|Japan|Asia|80
JO|Jordania|Jordan|Medio Oriente|30
KZ|Kazajistán|Kazakhstan|Asia|0
KE|Kenia|Kenya|África|20
KG|Kirguistán|Kyrgyzstan|Asia|0
KI|Kiribati|Kiribati|Oceanía|0
XK|Kosovo|Kosovo|Europa|0
KW|Kuwait|Kuwait|Medio Oriente|0
LA|Laos|Laos|Asia|10
LS|Lesoto|Lesotho|África|0
LV|Letonia|Latvia|Europa|20
LB|Líbano|Lebanon|Medio Oriente|10
LR|Liberia|Liberia|África|0
LY|Libia|Libya|África|0
LI|Liechtenstein|Liechtenstein|Europa|10
LT|Lituania|Lithuania|Europa|20
LU|Luxemburgo|Luxembourg|Europa|30
MO|Macao|Macao|Asia|10
MK|Macedonia del Norte|North Macedonia|Europa|10
MG|Madagascar|Madagascar|África|10
MY|Malasia|Malaysia|Asia|30
MW|Malaui|Malawi|África|0
MV|Maldivas|Maldives|Asia|10
ML|Malí|Mali|África|0
MT|Malta|Malta|Europa|30
MA|Marruecos|Morocco|África|70
MU|Mauricio|Mauritius|África|10
MR|Mauritania|Mauritania|África|0
MX|México|Mexico|América del Norte|90
FM|Micronesia|Micronesia|Oceanía|0
MD|Moldavia|Moldova|Europa|0
MC|Mónaco|Monaco|Europa|30
MN|Mongolia|Mongolia|Asia|10
ME|Montenegro|Montenegro|Europa|20
MZ|Mozambique|Mozambique|África|10
MM|Myanmar|Myanmar|Asia|0
NA|Namibia|Namibia|África|40
NR|Nauru|Nauru|Oceanía|0
NP|Nepal|Nepal|Asia|10
NI|Nicaragua|Nicaragua|América Central y Caribe|20
NE|Níger|Niger|África|0
NG|Nigeria|Nigeria|África|0
NO|Noruega|Norway|Europa|60
NZ|Nueva Zelanda|New Zealand|Oceanía|80
OM|Omán|Oman|Medio Oriente|20
NL|Países Bajos|Netherlands|Europa|76
PK|Pakistán|Pakistan|Asia|0
PW|Palaos|Palau|Oceanía|0
PS|Palestina|Palestine|Medio Oriente|0
PA|Panamá|Panama|América Central y Caribe|78
PG|Papúa Nueva Guinea|Papua New Guinea|Oceanía|0
PY|Paraguay|Paraguay|América del Sur|90
PE|Perú|Peru|América del Sur|88
PL|Polonia|Poland|Europa|40
PT|Portugal|Portugal|Europa|88
PR|Puerto Rico|Puerto Rico|América Central y Caribe|70
GB|Reino Unido|United Kingdom|Europa|85
CF|República Centroafricana|Central African Republic|África|0
CZ|República Checa|Czech Republic|Europa|40
CD|República Democrática del Congo|Democratic Republic of the Congo|África|0
DO|República Dominicana|Dominican Republic|América Central y Caribe|76
RW|Ruanda|Rwanda|África|0
RO|Rumania|Romania|Europa|30
RU|Rusia|Russia|Europa|10
WS|Samoa|Samoa|Oceanía|0
KN|San Cristóbal y Nieves|Saint Kitts and Nevis|América Central y Caribe|5
SM|San Marino|San Marino|Europa|10
VC|San Vicente y las Granadinas|Saint Vincent and the Grenadines|América Central y Caribe|5
LC|Santa Lucía|Saint Lucia|América Central y Caribe|5
ST|Santo Tomé y Príncipe|Sao Tome and Principe|África|0
SN|Senegal|Senegal|África|10
RS|Serbia|Serbia|Europa|10
SC|Seychelles|Seychelles|África|10
SL|Sierra Leona|Sierra Leone|África|0
SG|Singapur|Singapore|Asia|30
SY|Siria|Syrian Arab Republic|Medio Oriente|0
SO|Somalia|Somalia|África|0
LK|Sri Lanka|Sri Lanka|Asia|20
ZA|Sudáfrica|South Africa|África|70
SD|Sudán|Sudan|África|0
SS|Sudán del Sur|South Sudan|África|0
SE|Suecia|Sweden|Europa|50
CH|Suiza|Switzerland|Europa|78
SR|Surinam|Suriname|América del Sur|5
TH|Tailandia|Thailand|Asia|74
TW|Taiwán|Taiwan|Asia|20
TZ|Tanzania|Tanzania|África|20
TJ|Tayikistán|Tajikistan|Asia|0
TL|Timor Oriental|Timor-Leste|Asia|0
TG|Togo|Togo|África|0
TO|Tonga|Tonga|Oceanía|0
TT|Trinidad y Tobago|Trinidad and Tobago|América Central y Caribe|10
TN|Túnez|Tunisia|África|20
TM|Turkmenistán|Turkmenistan|Asia|0
TR|Turquía|Turkey|Europa|72
TV|Tuvalu|Tuvalu|Oceanía|0
UA|Ucrania|Ukraine|Europa|10
UG|Uganda|Uganda|África|0
UY|Uruguay|Uruguay|América del Sur|99
UZ|Uzbekistán|Uzbekistan|Asia|0
VU|Vanuatu|Vanuatu|Oceanía|0
VE|Venezuela|Venezuela|América del Sur|30
VN|Vietnam|Vietnam|Asia|40
YE|Yemen|Yemen|Medio Oriente|0
DJ|Yibuti|Djibouti|África|0
ZM|Zambia|Zambia|África|10
ZW|Zimbabue|Zimbabwe|África|10
`;

// Partes según la Colección de Tratados de la ONU (XI-B-1 y XI-B-19).
const GINEBRA_1949 = `Albania;Algeria;Argentina;Australia;Austria;Bangladesh;Barbados;Belgium;Benin;Botswana;Brunei;Bulgaria;Burkina Faso;Cambodia;Canada;Central African Republic;Chile;Congo;Côte d'Ivoire;Croatia;Cuba;Cyprus;Czech Republic;Democratic Republic of the Congo;Denmark;Dominican Republic;Ecuador;Egypt;Estonia;Fiji;Finland;France;Georgia;Ghana;Greece;Guatemala;Haiti;Holy See;Hungary;Iceland;India;Ireland;Israel;Italy;Jamaica;Japan;Jordan;Kyrgyzstan;Laos;Lebanon;Lesotho;Liechtenstein;Lithuania;Luxembourg;Madagascar;Malawi;Malaysia;Mali;Malta;Monaco;Montenegro;Morocco;Namibia;Netherlands;New Zealand;Niger;Nigeria;Norway;Papua New Guinea;Paraguay;Peru;Philippines;Poland;Portugal;Romania;Russia;Rwanda;San Marino;Senegal;Serbia;Sierra Leone;Singapore;Slovakia;Slovenia;South Africa;South Korea;Spain;Sri Lanka;Sweden;Syrian Arab Republic;Thailand;Togo;Trinidad and Tobago;Tunisia;Turkey;Uganda;United Arab Emirates;United Kingdom;United States;Venezuela;Vietnam;Zimbabwe`.split(';');

const VIENA_1968 = `Albania;Armenia;Austria;Azerbaijan;Bahamas;Bahrain;Belarus;Belgium;Benin;Bosnia and Herzegovina;Brazil;Bulgaria;Cabo Verde;Central African Republic;Côte d'Ivoire;Croatia;Cuba;Czech Republic;Democratic Republic of the Congo;Denmark;Egypt;Estonia;Ethiopia;Finland;France;Georgia;Germany;Greece;Guyana;Honduras;Hungary;Iran;Iraq;Israel;Italy;Kazakhstan;Kenya;Kuwait;Kyrgyzstan;Latvia;Liberia;Liechtenstein;Lithuania;Luxembourg;Moldova;Monaco;Mongolia;Montenegro;Morocco;Myanmar;Netherlands;Niger;Nigeria;North Macedonia;Norway;Oman;Pakistan;Palestine;Peru;Philippines;Poland;Portugal;Qatar;Romania;Russia;San Marino;Saudi Arabia;Senegal;Serbia;Seychelles;Slovakia;Slovenia;South Africa;Sweden;Switzerland;Tajikistan;Thailand;Tunisia;Turkey;Turkmenistan;Uganda;Ukraine;United Kingdom;Uruguay;Uzbekistan;Vietnam;Zimbabwe`.split(';');

const FUENTE_GINEBRA = {
  titulo: 'Colección de Tratados de la ONU — Estado de la Convención sobre la Circulación por Carretera (Ginebra, 1949)',
  url: 'https://treaties.un.org/Pages/ViewDetailsV.aspx?src=TREATY&mtdsg_no=XI-B-1&chapter=11&Temp=mtdsg5&clang=_en',
};
const FUENTE_VIENA = {
  titulo: 'Colección de Tratados de la ONU — Estado de la Convención sobre la Circulación Vial (Viena, 1968)',
  url: 'https://treaties.un.org/Pages/ViewDetailsIII.aspx?src=TREATY&mtdsg_no=XI-B-19&chapter=11&Temp=mtdsg3&clang=_en',
};

function resumenInicial(nombre, g, v) {
  if (g && v) return `${nombre} es parte de las convenciones de Ginebra (1949) y de Viena (1968) de la ONU, por lo que reconoce el Permiso Internacional de Conducir de ambos modelos. Estamos verificando en fuentes oficiales si lo exige a turistas.`;
  if (g) return `${nombre} es parte de la Convención de Ginebra de 1949 de la ONU, por lo que reconoce el Permiso Internacional de Conducir modelo 1949. Estamos verificando en fuentes oficiales si lo exige a turistas.`;
  if (v) return `${nombre} es parte de la Convención de Viena de 1968 de la ONU, por lo que reconoce el Permiso Internacional de Conducir modelo 1968. Estamos verificando en fuentes oficiales si lo exige a turistas.`;
  return `${nombre} no figura como parte de las convenciones de Ginebra (1949) ni de Viena (1968) en el registro de tratados de la ONU, así que las reglas para conductores extranjeros dependen de su legislación interna. Estamos verificando en fuentes oficiales qué documentación exige.`;
}

// Fichas verificadas a mano el 21/10/2026 (el resto las completa la actualización semanal).
const VERIFICADOS = {
  AR: {
    requisito: 'depende',
    resumen: 'Argentina es parte de la Convención de Ginebra de 1949 y de la Convención Interamericana de Washington de 1943. Con una licencia de un país del Mercosur alcanza la licencia nacional; con licencias de otros países, Argentina puede exigir el Permiso Internacional como prevé el artículo 24 de la Convención de Ginebra.',
    detalles: [
      'Dentro del Mercosur la licencia de conducir nacional mantiene su validez, sin trámite adicional.',
      'Para residentes en Argentina, el Permiso Internacional y el Interamericano los emite el Automóvil Club Argentino (ACA), conforme a las convenciones de Ginebra 1949 y Washington 1943.',
      'El trámite en el ACA es personal, presencial y sin turno previo: se presenta la licencia argentina vigente y el DNI, originales y fotocopia.',
      'El permiso emitido en Argentina vale un año, o hasta el vencimiento de la licencia nacional si es anterior, y siempre se usa junto con la licencia.',
      'Según la Agencia Nacional de Seguridad Vial, la licencia argentina vigente desde 2017 incluye nomenclatura internacional (normas ISO y convenciones de Ginebra y Viena).',
    ],
    convencionAceptada: '1949',
    estadiaMaxima: null,
    autoridadTransito: { nombre: 'Agencia Nacional de Seguridad Vial (ANSV)', url: 'https://www.argentina.gob.ar/seguridadvial' },
    emisorPIC: { nombre: 'Automóvil Club Argentino (ACA)', url: 'https://www.aca.org.ar/registro-internacional/', telefono: '0800-888-9888' },
    fuentes: [
      { titulo: 'Automóvil Club Argentino — Permiso Internacional', url: 'https://www.aca.org.ar/registro-internacional/' },
      { titulo: 'Automóvil Club Argentino — Requisitos del Permiso Internacional', url: 'https://www.aca.org.ar/popup/requisitos-registro-internacional-2/' },
      { titulo: 'La Nación — Cómo usar la licencia argentina en el exterior', url: 'https://www.lanacion.com.ar/autos/licencia-de-conducir-como-usar-el-registro-argentino-en-el-exterior-y-que-requisito-extra-hay-que-nid23032023' },
      { titulo: 'Comparaencasa — Licencia internacional de conducir (Mercosur)', url: 'https://www.comparaencasa.com/seguros-de-auto/novedades/licencia-internacional-de-conducir/' },
      FUENTE_GINEBRA,
    ],
  },
  UY: {
    requisito: 'depende',
    resumen: 'Uruguay es parte de la Convención de Viena de 1968. Con una licencia de un país del Mercosur alcanza la licencia nacional; para licencias de otros países, Uruguay reconoce el Permiso Internacional modelo 1968 presentado junto con la licencia nacional.',
    detalles: [
      'Para quienes llegan desde un país del Mercosur rige plenamente la licencia de su país, sin obligación de revalidarla, según el criterio del Congreso de Intendentes.',
      'Para residentes en Uruguay, el permiso lo expide el Automóvil Club del Uruguay (ACU), que invoca el Decreto Presidencial Nº 2 del 23 de mayo de 1930.',
      'El trámite en el ACU es presencial porque el solicitante debe firmar el documento al momento de la expedición. Se presenta la licencia y la cédula vigentes y una foto carné.',
      'El permiso emitido en Uruguay vale como máximo un año, o hasta el vencimiento de la licencia nacional si es anterior.',
      'Las licencias de conducir uruguayas (Permiso Único Nacional de Conducir) las otorgan las intendencias departamentales a través del sistema SUCIVE.',
    ],
    convencionAceptada: '1968',
    estadiaMaxima: null,
    autoridadTransito: { nombre: 'Unidad Nacional de Seguridad Vial (UNASEV)', url: 'https://www.gub.uy/unidad-nacional-seguridad-vial/' },
    emisorPIC: { nombre: 'Automóvil Club del Uruguay (ACU)', url: 'https://acu.com.uy/agencia-de-viajes/', telefono: '1707 int. 837' },
    fuentes: [
      { titulo: 'Automóvil Club del Uruguay — Permiso Internacional de Conducir', url: 'https://acu.com.uy/agencia-de-viajes/' },
      { titulo: 'Intendencia de Montevideo — Circular 61/20 sobre licencias extranjeras y PUNC', url: 'https://montevideo.gub.uy/sites/default/files/biblioteca/circular61-20-puncextranjeros-criterios14.09.20.pdf' },
      { titulo: 'Congreso de Intendentes — Protocolo del Permiso Único Nacional de Conducir', url: 'https://www.gub.uy/congreso-intendentes/sites/congreso-intendentes/files/documentos/publicaciones/PROTOCOLO%20punc%202022.pdf' },
      FUENTE_VIENA,
    ],
  },
};

function main() {
  const destino = `${DATA}/paises.json`;
  if (existsSync(destino) && !process.argv.includes('--force')) {
    console.log(`${destino} ya existe. Usá --force para regenerarlo (se pierden las fichas verificadas).`);
    return;
  }
  const hoy = hoyISO();
  const paises = TABLA.trim().split('\n').map((linea) => {
    const [iso2, nombre, nombreEn, region, prioridad] = linea.split('|');
    const g = GINEBRA_1949.includes(nombreEn);
    const v = VIENA_1968.includes(nombreEn);
    const base = {
      iso2,
      slug: slugify(nombre),
      nombre,
      nombreEn,
      region,
      prioridad: Number(prioridad),
      convenios: { ginebra1949: g, viena1968: v },
      requisito: 'sin-verificar',
      resumen: resumenInicial(nombre, g, v),
      detalles: [],
      convencionAceptada: g && v ? 'ambas' : g ? '1949' : v ? '1968' : 'ninguna',
      estadiaMaxima: null,
      autoridadTransito: null,
      emisorPIC: null,
      fuentes: [g && FUENTE_GINEBRA, v && FUENTE_VIENA, !g && !v && FUENTE_GINEBRA, !g && !v && FUENTE_VIENA]
        .filter(Boolean)
        .map((f) => ({ ...f, consultado: '2025-03-02' })),
      actualizado: null,
      ultimaRevision: null,
      verificado: false,
      historial: [],
    };
    const manual = VERIFICADOS[iso2];
    if (!manual) return base;
    return {
      ...base,
      ...manual,
      fuentes: manual.fuentes.map((f) => ({ ...f, consultado: hoy })),
      actualizado: hoy,
      ultimaRevision: hoy,
      verificado: true,
      historial: [{ fecha: hoy, requisito: manual.requisito, origen: 'revisión manual' }],
    };
  });
  paises.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const faltan = [...GINEBRA_1949, ...VIENA_1968].filter((n) => !paises.some((p) => p.nombreEn === n));
  if (faltan.length) console.warn('Partes sin país en la tabla:', [...new Set(faltan)]);
  writeJSON(destino, paises);
  console.log(`Escribí ${paises.length} países en ${destino}`);
}

main();

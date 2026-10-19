// tests/preset-instan.test.js
// Pengujian Preset Instan (T1-T5): parser, workflow, remixer, validasi XML,
// inti sesi, manajer sesi (fs), dan plugin .preset.
// Fixture PB1/PB19 disalin APA ADANYA dari tests/presetParser.test.js
// repositori Ndolzz/nazevector (ekspor asli Alight Motion 5.0.273 Android).
// Pelaksanaan: node tests/preset-instan.test.js (Node ESM).
// Bagian setelah penanda RUNNER hanya berjalan di Node; fungsi
// runPresetInstanTests() dapat dipanggil dari harness lingkungan uji lain.
// Kejujuran: pengujian ini MEMAKAI objek pesan palsu yang meniru kontrak
// serialisasi (src/lib/naze-serialize.js); uji WhatsApp nyata, impor ke
// aplikasi Alight Motion asli, dan render tetap diperlukan di lapangan.

const REAL_AM_EXPORT_FIXTURE = "<?xml version='1.0' encoding='UTF-8' ?><!--\nCreated by Alight Motion (http://alightmotion.com)\nExported: 2026-10-03 08:34 AM\n5.0.273.1028425 (1028425)\n2d5c0f8 (20 Mei 2026 04.16.19)\n-->\n<scene title=\"Proyek Baru 1\" width=\"1080\" height=\"1350\" exportWidth=\"1080\" exportHeight=\"1350\" precompose=\"dynamicResolution\" bgcolor=\"#ffd8d8d8\" totalTime=\"2032\" fps=\"30\" modifiedTime=\"1790991248751\" amver=\"1028425\" ffver=\"106\" am=\"com.alightcreative.motion/5.0.273.1028425\" amplatform=\"android\" retime=\"freeze\" retimeAdaptFPS=\"false\">\n  <media uri=\"content://media/external/images/media/1000943531\" filename=\"IMG-20261002-WA0040.jpg\" title=\"IMG-20261002-WA0040.jpg\" type=\"image/jpeg\" size=\"77267\" orientation=\"0\" infoUpdated=\"1790991214653\" width=\"720\" height=\"1280\" />\n  <shape id=\"205153572\" label=\"IMG-20261002-WA0040.jpg\" startTime=\"0\" endTime=\"2032\" fillType=\"media\" fillImage=\"content://media/external/images/media/1000943531\" mediaFillMode=\"fill\" s=\".rect\">\n    <transform>\n      <location value=\"540.000000,675.000000,0.000000\" />\n      <scale value=\"1.472593,1.472593\" />\n    </transform>\n    <property name=\"size\" type=\"vec2\" value=\"379.500000,675.000000\" />\n  </shape>\n  <shape id=\"205153573\" label=\"Persegi panjang 1\" startTime=\"0\" endTime=\"932\" fillType=\"color\" blending=\"mask\" mediaFillMode=\"fill\" s=\".rect\">\n    <transform>\n      <location value=\"532.500000,641.999939,0.000000\" />\n    </transform>\n    <fillColor value=\"#ffaac9af\" />\n    <property name=\"size\" type=\"vec2\" value=\"496.750000,496.750031\" />\n  </shape>\n  <shape id=\"205153574\" label=\"Persegi panjang 1\" startTime=\"900\" endTime=\"2032\" fillType=\"color\" blending=\"exclude\" mediaFillMode=\"fill\" s=\".rect\">\n    <transform>\n      <location value=\"532.500000,641.999939,0.000000\" />\n    </transform>\n    <fillColor value=\"#ffaac9af\" />\n    <property name=\"size\" type=\"vec2\" value=\"496.750000,496.750031\" />\n  </shape>\n</scene>";

const REAL_AM_IMPORTED_PATH_FIXTURE = `<?xml version='1.0' encoding='UTF-8' ?><!--
Created by Alight Motion (http://alightmotion.com)
Exported: 2026-09-30 02:55 AM
5.0.273.1028425 (1028425)
2d5c0f8 (20 Mei 2026 04.16.19)
-->
<scene title="Proyek Baru 19" width="1080" height="1350" exportWidth="1080" exportHeight="1350" precompose="dynamicResolution" bgcolor="#ff00b140" totalTime="7148" fps="60" modifiedTime="1790711706386" amver="1028425" ffver="106" am="com.alightcreative.motion/5.0.273.1028425" amplatform="android" retime="freeze" retimeAdaptFPS="false">
  <media uri="content://media/external/images/media/1000891919" filename="mascot-wink-cutout.png" title="mascot-wink-cutout.png" type="image/png" size="1019645" orientation="0" infoUpdated="1790711701374" width="782" height="941" />
  <media uri="am:4DA4437668755B26FE88E3FB73A9D712C287E1EA.png" filename="Profil Copy 3 Copy 3 [3C65A93].png" title="Profil Copy 3 Copy 3 [3C65A93].png" type="image/png" size="3601000" sig="4DA4437668755B26FE88E3FB73A9D712C287E1EA" orientation="0" infoUpdated="1790711701374" width="2160" height="3840" />
  <media uri="content://media/external/images/media/1000899918" type="image/png" duration="0" orientation="0" infoUpdated="1790711701374" width="0" height="0" />
  <shape id="1787713685974" label="mascot-wink-cutout.png" startTime="0" endTime="2015" fillType="media" fillImage="content://media/external/images/media/1000891919" mediaFillMode="fill" s=".rect">
    <transform>
      <location>
        <kf t="0.003970" v="540.000000,675.000000,0.000000" />
        <kf t="0.186104" v="588.500000,715.500000,0.000000" />
        <kf t="0.260546" v="633.000000,525.000000,0.000000" />
      </location>
    </transform>
    <effect id="com.alightcreative.effects.fade" locallyApplied="true">
      <property name="inTime" type="float" value="0.600000" />
      <property name="outTime" type="float" value="0.300000" />
    </effect>
    <property name="size" type="vec2" value="540.000000,649.500000" />
  </shape>
  <shape id="1787713685975" startTime="2016" endTime="7148" fillType="media" fillImage="am:4DA4437668755B26FE88E3FB73A9D712C287E1EA.png" mediaFillMode="fill">
    <transform>
      <location>
        <kf t="0.706742" v="540.210266,960.149780,0.000000" />
        <kf t="0.999026" v="540.210266,960.149780,0.000000" />
        <kf t="0.862627" v="540.210266,1396.574097,0.000000" e="cubicBezier 0.9 -0.91 1.0 1.0" />
        <kf t="0.950507" v="570.840637,812.174683,0.000000" />
      </location>
      <scale>
        <kf t="0.270850" v="1.500000,1.500000" e="cubicBezier 0.42 0.0 0.0 1.0" />
        <kf t="0.501754" v="2.478515,2.478515" e="cubicBezier 0.7184972 0.0 0.44273883 1.0" />
        <kf t="0.706742" v="1.500000,1.500000" e="cubicBezier 0.31319663 0.0 0.08122213 1.0" />
        <kf t="0.000585" v="2.579479,2.579479" />
        <kf t="0.862627" v="2.208864,2.208864" e="cubicBezier 0.89643914 -0.91275054 1.0 1.0" />
        <kf t="0.999026" v="2.207012,2.207012" e="cubicBezier 1.0 0.0 1.0 1.0" />
        <kf t="0.960055" v="1.649235,1.649235" e="cubicBezier 0.0 0.0 0.22396892 1.0" />
      </scale>
    </transform>
    <path d="M -360.0 -640.0L 360.0 -640.0L 360.0 640.0L -360.0 640.0L -360.0 -640.0Z" />
  </shape>
  <shape id="1787713685979" label="Bentuk 1" startTime="850" endTime="1365" fillType="media" fillImage="content://media/external/images/media/1000899918" mediaFillMode="fit">
    <transform>
      <location value="540.000000,675.000000,0.000000" />
    </transform>
    <fillColor value="#ffecb455" />
    <path-stroke direction="centered" end-size="1.500000">
      <size value="6.500000" />
    </path-stroke>
    <path d="M -359.73874 256.04205L -162.86777 -82.89453L 185.36041 78.60547L 143.92258 221.64441L -529.2438 -334.3945L -34.49997 352.5L -359.73874 256.04205" />
  </shape>
  <shape id="1787713685980" label="Bentuk 1" startTime="1350" endTime="1899" fillType="media" fillImage="content://media/external/images/media/1000899918" mediaFillMode="fill">
    <transform>
      <location value="540.000000,675.000000,0.000000" />
    </transform>
    <fillColor value="#ffecb455" />
    <border direction="inside" id="1">
      <size value="13.000000" />
    </border>
    <path-stroke direction="centered" cap="square" end-size="1.500000">
      <size value="3.500000" />
    </path-stroke>
    <shadow direction="outside">
      <size value="9.000000" />
    </shadow>
    <path d="M -359.73874 256.04205L -162.86777 -82.89453L 185.36041 78.60547L 143.92258 221.64441L 66.00003 246.0L -34.49997 352.5L -359.73874 256.04205" />
  </shape>
  <shape id="1787713685981" label="Bentuk 1" startTime="1883" endTime="2865" fillType="media" fillImage="content://media/external/images/media/1000899918" mediaFillMode="stretch">
    <transform>
      <location value="540.000000,675.000000,0.000000" />
    </transform>
    <fillColor value="#ffecb455" />
    <path d="M -359.73874 256.04205L -162.86777 -82.89453L 185.36041 78.60547L 143.92258 221.64441L 66.00003 246.0L -34.49997 352.5L -359.73874 256.04205" />
  </shape>
</scene>`.replace(/\n/g, '\r\n');

const PB1_SLOT_URI = "content://media/external/images/media/1000943531";
const PB19_SLOT1_URI = "content://media/external/images/media/1000891919";
const PB19_SLOT2_URI = "am:4DA4437668755B26FE88E3FB73A9D712C287E1EA.png";
const PB19_SLOT3_URI = "content://media/external/images/media/1000899918";

const XML_NO_SLOT_FIXTURE =
  '<scene title="Tanpa Slot" width="1080" height="1350" exportWidth="1080" exportHeight="1350" precompose="dynamicResolution" bgcolor="#ff112233" totalTime="1000" fps="30" modifiedTime="1790991248751" amver="1028425" ffver="106" am="com.alightcreative.motion/5.0.273.1028425" amplatform="android" retime="freeze" retimeAdaptFPS="false"><shape id="1" label="Persegi" startTime="0" endTime="1000" fillType="color" mediaFillMode="fill"><transform><location value="540.000000,675.000000,0.000000" /></transform><fillColor value="#ffff0000" /><property name="size" type="vec2" value="200.000000,200.000000" /></shape></scene>';

const XML_UNDECLARED_FIXTURE =
  '<scene title="Tanpa Deklarasi" width="1080" height="1350" exportWidth="1080" exportHeight="1350" precompose="dynamicResolution" bgcolor="#ff112233" totalTime="1000" fps="30" modifiedTime="1790991248751" amver="1028425" ffver="106" am="com.alightcreative.motion/5.0.273.1028425" amplatform="android" retime="freeze" retimeAdaptFPS="false"><shape id="1" label="Layer" startTime="0" endTime="1000" fillType="media" fillImage="content://media/luar/gambar.png" mediaFillMode="fill"><transform><location value="540.000000,675.000000,0.000000" /></transform></shape></scene>';

/* ---------- Bytes helper (Buffer tersedia: global di Node, param harness) ---------- */

function jpegBytes() {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00]);
}
function pngBytes() {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
}
function webpBytes() {
  return Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x00, 0x00]);
}
function zipBytes() {
  return Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00]);
}
function xmlBytes(text) {
  return Buffer.from(text, "utf8");
}
function bytesText(buffer) {
  return String(buffer);
}

/* ---------- Objek pesan palsu meniru kontrak naze-serialize.js ---------- */

function fakeMessage(overrides) {
  const o = overrides || {};
  const sent = [];
  const msg = {
    sender: o.sender || "100@s.whatsapp.net",
    chat: o.chat || o.sender || "100@s.whatsapp.net",
    pushName: o.pushName || "Penguji",
    prefix: o.prefix || ".",
    command: o.command || "",
    body: o.body || "",
    text: o.text || "",
    isCommand: !!o.isCommand,
    isMedia: !!o.isMedia,
    isImage: !!o.isImage,
    isVideo: !!o.isVideo,
    isDocument: !!o.isDocument,
    fileName: o.fileName || "",
    quoted: o.quoted || null,
    message: o.message || {},
    replies: sent,
    reply: async (text) => {
      sent.push({ type: "text", text: String(text) });
      return { sent: true };
    },
    replyDocument: async (doc, name, mimetype, options) => {
      sent.push({
        type: "document",
        doc,
        name,
        mimetype,
        caption: (options && options.caption) || "",
      });
      return { sent: true };
    },
    react: async () => null,
    download: async () => (o.buffer !== undefined ? o.buffer : null),
  };
  return msg;
}

function documentMessage(buffer, fileName, sender) {
  return fakeMessage({
    sender,
    isDocument: true,
    isMedia: true,
    fileName,
    buffer,
    message: { documentMessage: { fileName: fileName, mimetype: "" } },
  });
}

function mediaMessage(buffer, sender, chat) {
  return fakeMessage({ sender, chat, isMedia: true, isImage: true, buffer });
}

/* ---------- Pengujian ---------- */

export async function runPresetInstanTests() {
  const failures = [];
  let total = 0;
  let skipped = 0;

  function test(name, fn) {
    total += 1;
    try {
      fn();
    } catch (error) {
      failures.push({
        name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function testAsync(name, fn) {
    total += 1;
    try {
      await fn();
    } catch (error) {
      failures.push({
        name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function skipTest(name, reason) {
    total += 1;
    skipped += 1;
    if (typeof console !== "undefined" && console.log) {
      console.log("DILEWATI [" + name + "] " + reason);
    }
  }

  function assert(condition, message) {
    if (!condition) throw new Error(message || "Asersi gagal.");
  }

  /* ===== Parser dan workflow ===== */

  test("PAR-1 analisis PB1: scene, fps, durasi, layer", () => {
    const a = analyzePresetText(REAL_AM_EXPORT_FIXTURE);
    assert(a.ok === true, "ok: " + a.error);
    assert(a.summary.fps === 30, "fps: " + a.summary.fps);
    assert(a.summary.totalTime === 2032, "totalTime: " + a.summary.totalTime);
    assert(a.summary.width === 1080 && a.summary.height === 1350, "dimensi");
    assert(a.summary.layerCount === 3, "layer: " + a.summary.layerCount);
    assert(a.summary.mediaCount === 1, "media: " + a.summary.mediaCount);
    assert(a.summary.keyframeCount === 0, "keyframe: " + a.summary.keyframeCount);
    assert(a.summary.title === "Proyek Baru 1", "judul: " + a.summary.title);
  });

  test("PAR-2 analisis PB1: satu slot foto terdeklarasi", () => {
    const a = analyzePresetText(REAL_AM_EXPORT_FIXTURE);
    assert(a.slots.length === 1, "slot: " + a.slots.length);
    const s = a.slots[0];
    assert(s.uri === PB1_SLOT_URI, "uri");
    assert(s.kind === "image", "kind");
    assert(s.declared === true, "declared");
    assert(s.filename === "IMG-20261002-WA0040.jpg", "filename");
    assert(s.layerCount === 1, "layerCount");
    assert(s.declarationCount === 1, "declarationCount");
  });

  test("PAR-3 analisis PB19: tiga slot, 14 keyframe, struktur dipertahankan", () => {
    const a = analyzePresetText(REAL_AM_IMPORTED_PATH_FIXTURE);
    assert(a.ok === true, "ok: " + a.error);
    assert(a.summary.fps === 60, "fps 60");
    assert(a.summary.totalTime === 7148, "totalTime");
    assert(a.summary.layerCount === 5, "layer");
    assert(a.summary.mediaCount === 3, "media");
    assert(a.summary.keyframeCount === 14, "keyframe: " + a.summary.keyframeCount);
    assert(a.slots.length === 3, "slot: " + a.slots.length);
    const kinds = a.unsupported.map((u) => u.kind);
    assert(kinds.includes("effect"), "efek dilaporkan");
    assert(kinds.filter((k) => k === "pathStroke").length === 2, "path-stroke");
    assert(kinds.includes("border"), "border");
    assert(kinds.includes("shadow"), "shadow");
  });

  test("PAR-4 XML rusak ditolak dengan pesan", () => {
    const a = analyzePresetText("<scene><shape id=\"1\"></scene>");
    assert(a.ok === false, "harus gagal");
    assert(a.error && a.error.length > 0, "pesan error");
    assert(a.error.includes("shape"), "menyebut tag: " + a.error);
  });

  test("PAR-5 masukan kosong atau null ditolak", () => {
    assert(analyzePresetText("").ok === false, "kosong");
    assert(analyzePresetText(null).ok === false, "null");
    assert(parseAlightMotionProject(null).ok === false, "parser null");
  });

  test("PAR-6 XML valid tanpa slot media dianalisis dengan nol slot", () => {
    const a = analyzePresetText(XML_NO_SLOT_FIXTURE);
    assert(a.ok === true, "ok: " + a.error);
    assert(a.slots.length === 0, "slot: " + a.slots.length);
    assert(a.summary.layerCount === 1, "layer");
  });

  test("WF-1 validatePresetFileInput menerima .xml ukuran wajar", () => {
    const r = validatePresetFileInput({ name: "preset.xml", size: 1000 });
    assert(r.ok === true, "ok: " + r.error);
  });

  test("WF-2 validatePresetFileInput menolak format tidak dikenal", () => {
    assert(validatePresetFileInput({ name: "a.mp4", size: 10, type: "video/mp4" }).ok === false, "mp4");
    assert(validatePresetFileInput({ name: "a.txt", size: 10, type: "" }).ok === false, "txt tanpa mime");
    assert(validatePresetFileInput({ name: "a.xml", size: 10, type: "text/plain" }).ok === true, "teks dengan mime teks diterima");
    assert(validatePresetFileInput(null).ok === false, "null");
  });

  test("WF-3 validatePresetFileInput menolak ukuran nol dan melebihi batas", () => {
    assert(validatePresetFileInput({ name: "a.xml", size: 0 }).ok === false, "nol");
    const tooBig = { name: "a.xml", size: PRESET_MAX_BYTES + 1 };
    assert(validatePresetFileInput(tooBig).ok === false, "terlalu besar");
  });

  test("WF-4 normalizeReplacementUri menolak kosong dan karakter terlarang", () => {
    assert(normalizeReplacementUri("").ok === false, "kosong");
    assert(normalizeReplacementUri("   ").ok === false, "spasi");
    assert(normalizeReplacementUri('a"b').ok === false, "kutip");
    assert(normalizeReplacementUri("a<b").ok === false, "kurung buka");
    assert(normalizeReplacementUri(null).ok === false, "null");
    const ok = normalizeReplacementUri("naze-preset://slot/1/foto.jpg");
    assert(ok.ok === true && ok.uri === "naze-preset://slot/1/foto.jpg", "valid");
  });

  test("WF-5 buildReplacement merakit metadata berkas", () => {
    const r = buildReplacement(PB1_SLOT_URI, "naze-preset://slot/1/foto.jpg", {
      name: "foto.jpg",
      size: 12345,
      width: 720,
      height: 1280,
    });
    assert(r.ok === true, "ok: " + r.error);
    assert(r.replacement.filename === "foto.jpg", "filename");
    assert(r.replacement.size === 12345, "size");
    assert(r.replacement.width === 720 && r.replacement.height === 1280, "dimensi");
  });

  test("WF-6 buildRemixDownloadName menurunkan nama unduhan", () => {
    assert(buildRemixDownloadName("Preset Keren.xml") === "preset-keren-remix", "turunan: " + buildRemixDownloadName("Preset Keren.xml"));
    assert(buildRemixDownloadName("") === "preset-remix", "kosong");
  });

  /* ===== Remixer ===== */

  test("REM-1 penggantian PB1 valid: uri, fillImage, dan metadata diperbarui", () => {
    const built = buildReplacement(PB1_SLOT_URI, "naze-preset://slot/1/foto.jpg", {
      name: "foto.jpg",
      size: 12345,
      width: 720,
      height: 1280,
    });
    const res = remixPreset(REAL_AM_EXPORT_FIXTURE, [built.replacement]);
    assert(res.ok === true, "ok: " + res.error);
    assert(res.xml.includes('uri="naze-preset://slot/1/foto.jpg"'), "uri media");
    assert(res.xml.includes('fillImage="naze-preset://slot/1/foto.jpg"'), "fillImage");
    assert(!res.xml.includes(PB1_SLOT_URI), "uri lama hilang");
    assert(res.xml.includes('filename="foto.jpg"'), "filename");
    assert(res.xml.includes('size="12345"'), "size");
    assert(res.xml.includes('width="720"'), "width");
    assert(res.xml.includes('height="1280"'), "height");
    assert(res.validation.valid === true, "validasi hasil");
    assert(res.untouchedSlots.length === 0, "tidak ada slot lain");
  });

  test("REM-2 PB19: keyframe, durasi, urutan layer, efek tetap utuh", () => {
    const built = buildReplacement(PB19_SLOT1_URI, "naze-preset://slot/1/foto.png", { name: "foto.png", size: 999 });
    const res = remixPreset(REAL_AM_IMPORTED_PATH_FIXTURE, [built.replacement]);
    assert(res.ok === true, "ok: " + res.error);
    const kfTimes = ["0.003970", "0.186104", "0.260546", "0.706742", "0.999026", "0.862627", "0.950507", "0.270850", "0.501754", "0.000585", "0.960055"];
    for (const t of kfTimes) {
      assert(res.xml.includes('<kf t="' + t + '"'), "kf ' + t + ' hilang: " + t);
    }
    assert(res.xml.includes('e="cubicBezier 0.42 0.0 0.0 1.0"'), "easing utuh");
    assert(res.xml.includes('e="cubicBezier 0.89643914 -0.91275054 1.0 1.0"'), "easing negatif utuh");
    assert(res.xml.includes('totalTime="7148"'), "totalTime");
    assert(res.xml.includes('fps="60"'), "fps");
    assert(res.xml.includes('com.alightcreative.effects.fade'), "efek utuh");
    assert(res.xml.includes('<border direction="inside" id="1">'), "border utuh");
    assert(res.xml.includes("<shadow direction=\"outside\">"), "shadow utuh");
    assert(res.xml.includes('path d="M -359.73874 256.04205'), "path utuh");
    const order = ["1787713685974", "1787713685975", "1787713685979", "1787713685980", "1787713685981"];
    let last = -1;
    for (const id of order) {
      const idx = res.xml.indexOf('id="' + id + '"');
      assert(idx > last, "urutan layer berubah pada " + id);
      last = idx;
    }
    assert(res.xml.includes('startTime="1883" endTime="2865"'), "durasi layer utuh");
  });

  test("REM-3 slot tidak dikenal ditolak", () => {
    const res = remixPreset(REAL_AM_EXPORT_FIXTURE, [
      { fromUri: "content://media/tidak-ada.png", toUri: "naze-preset://slot/9/x.png" },
    ]);
    assert(res.ok === false, "harus gagal");
    assert(res.error.includes("tidak dikenal"), "pesan: " + res.error);
  });

  test("REM-4 slot tanpa deklarasi media ditolak", () => {
    const res = remixPreset(XML_UNDECLARED_FIXTURE, [
      { fromUri: "content://media/luar/gambar.png", toUri: "naze-preset://slot/1/x.png" },
    ]);
    assert(res.ok === false, "harus gagal");
    assert(res.error.includes("tidak dideklarasikan"), "pesan: " + res.error);
  });

  test("REM-5 fromUri duplikat ditolak", () => {
    const res = remixPreset(REAL_AM_IMPORTED_PATH_FIXTURE, [
      { fromUri: PB19_SLOT1_URI, toUri: "naze-preset://slot/1/a.png" },
      { fromUri: PB19_SLOT1_URI, toUri: "naze-preset://slot/2/b.png" },
    ]);
    assert(res.ok === false, "harus gagal");
    assert(res.error.includes("duplikat"), "pesan: " + res.error);
  });

  test("REM-6 toUri yang bertabrakan dengan slot lain ditolak", () => {
    const res = remixPreset(REAL_AM_IMPORTED_PATH_FIXTURE, [
      { fromUri: PB19_SLOT1_URI, toUri: PB19_SLOT2_URI },
    ]);
    assert(res.ok === false, "harus gagal");
    assert(res.error.includes("bertabrakan"), "pesan: " + res.error);
  });

  test("REM-7 PB19: slot yang tidak diganti tetap utuh", () => {
    const built = buildReplacement(PB19_SLOT1_URI, "naze-preset://slot/1/foto.png", { name: "foto.png", size: 999 });
    const res = remixPreset(REAL_AM_IMPORTED_PATH_FIXTURE, [built.replacement]);
    assert(res.ok === true, "ok: " + res.error);
    assert(res.untouchedSlots.length === 2, "dua slot tak tersentuh: " + JSON.stringify(res.untouchedSlots));
    assert(res.xml.includes(PB19_SLOT2_URI), "slot 2 utuh");
    assert(res.xml.includes(PB19_SLOT3_URI), "slot 3 utuh");
  });

  /* ===== Validasi XML ===== */

  test("VAL-1 fixture ekspor asli lulus validasi", () => {
    const v = validateAlightMotionXml(REAL_AM_EXPORT_FIXTURE);
    assert(v.valid === true, "valid: " + JSON.stringify(v.issues));
  });

  test("VAL-2 XML rusak tidak lulus validasi", () => {
    const v = validateAlightMotionXml("<scene><shape id=\"1\"></scene>");
    assert(v.valid === false, "harus gagal");
    assert(v.issues.length > 0, "ada masalah");
  });

  test("VAL-3 hasil remix lulus validasi struktur", () => {
    const built = buildReplacement(PB1_SLOT_URI, "naze-preset://slot/1/foto.jpg", { name: "foto.jpg", size: 1 });
    const res = remixPreset(REAL_AM_EXPORT_FIXTURE, [built.replacement]);
    assert(res.ok === true, "ok: " + res.error);
    const v = validateAlightMotionXml(res.xml);
    assert(v.valid === true, "valid: " + JSON.stringify(v.issues));
  });

  /* ===== Deteksi signature dan keamanan ===== */

  test("SNF-1 signature jpeg, png, webp, zip, xml dikenali", () => {
    assert(sniffBufferKind(jpegBytes()).kind === "jpeg", "jpeg");
    assert(sniffBufferKind(pngBytes()).kind === "png", "png");
    assert(sniffBufferKind(webpBytes()).kind === "webp", "webp");
    const z = sniffBufferKind(zipBytes());
    assert(z.kind === "zip" && z.ext === "zip", "zip");
    const x = sniffBufferKind(xmlBytes(REAL_AM_EXPORT_FIXTURE));
    assert(x.kind === "xml", "xml: " + x.kind);
  });

  test("SNF-2 byte asing dan buffer terlalu pendek tidak dikenali", () => {
    assert(sniffBufferKind(Buffer.from([1, 2, 3, 4, 5])).kind === "unknown", "asing");
    assert(sniffBufferKind(Buffer.from([1, 2])).kind === "unknown", "pendek");
    assert(sniffBufferKind(null).kind === "unknown", "null");
  });

  test("URL-1 tautan berbagi https alightcreative diterima", () => {
    const r = isSafeAlightShareUrl("https://alightcreative.com/am/share/abc123");
    assert(r.ok === true, "ok: " + r.error);
    const r2 = isSafeAlightShareUrl("  https://www.alightcreative.com/am/share/xyz  ");
    assert(r2.ok === true, "www diterima");
  });

  test("URL-2 skema non-https ditolak", () => {
    assert(isSafeAlightShareUrl("http://alightcreative.com/am/share/a").ok === false, "http");
    assert(isSafeAlightShareUrl("ftp://alightcreative.com/x").ok === false, "ftp");
    assert(isSafeAlightShareUrl("javascript:alert(1)").ok === false, "javascript");
    assert(isSafeAlightShareUrl("bukan url").ok === false, "invalid");
    assert(isSafeAlightShareUrl("").ok === false, "kosong");
  });

  test("URL-3 hostname berbahaya ditolak (SSRF, localhost, IP, userinfo)", () => {
    assert(isSafeAlightShareUrl("https://localhost/am/share/a").ok === false, "localhost");
    assert(isSafeAlightShareUrl("https://127.0.0.1/x").ok === false, "IP");
    assert(isSafeAlightShareUrl("https://169.254.169.254/latest/meta-data").ok === false, "metadata cloud");
    assert(isSafeAlightShareUrl("https://evil.com/am/share/a").ok === false, "host asing");
    assert(isSafeAlightShareUrl("https://alightcreative.com.evil.com/a").ok === false, "subdomain jahat");
    assert(isSafeAlightShareUrl("https://user:pass@alightcreative.com/a").ok === false, "userinfo");
    assert(isSafeAlightShareUrl("https://10.0.0.1:8080/internal").ok === false, "IP internal");
  });

  test("ZIP-1 nama entri aman diterima", () => {
    assert(isSafeZipEntryName("project.xml") === true, "sederhana");
    assert(isSafeZipEntryName("folder/project.xml") === true, "subfolder");
  });

  test("ZIP-2 nama entri berbahaya ditolak (path traversal dan lainnya)", () => {
    assert(isSafeZipEntryName("../evil.xml") === false, "naik direktori");
    assert(isSafeZipEntryName("a/../../evil.xml") === false, "naik bersarang");
    assert(isSafeZipEntryName("..\\evil.xml") === false, "backslash");
    assert(isSafeZipEntryName("/abs/path.xml") === false, "absolut");
    assert(isSafeZipEntryName("C:\\boot.xml") === false, "windows");
    assert(isSafeZipEntryName("bad\x00name.xml") === false, "karakter kontrol");
    assert(isSafeZipEntryName("") === false, "kosong");
    assert(isSafeZipEntryName("x".repeat(300)) === false, "terlalu panjang");
  });

  test("SEC-1 resolvePresetLimits menggabungkan batas dengan aman", () => {
    const d = resolvePresetLimits(null);
    assert(d.presetMaxBytes === DEFAULT_PRESET_LIMITS.presetMaxBytes, "default");
    assert(d.sessionTtlMs === DEFAULT_PRESET_LIMITS.sessionTtlMs, "ttl default");
    const custom = resolvePresetLimits({ mediaMaxBytes: 1024, sessionTtlMs: -5, presetMaxBytes: "bukan angka" });
    assert(custom.mediaMaxBytes === 1024, "override valid");
    assert(custom.sessionTtlMs === DEFAULT_PRESET_LIMITS.sessionTtlMs, "nilai negatif diabaikan");
    assert(custom.presetMaxBytes === DEFAULT_PRESET_LIMITS.presetMaxBytes, "non-angka diabaikan");
  });

  test("SEC-2 sanitizeName dan buildSlotLabelUri", () => {
    assert(sanitizeName("foto saya!!!(1).jpg") !== "", "tersanitasi");
    assert(!sanitizeName("../etc/passwd").includes(".."), "traversal dibersihkan");
    assert(sanitizeName("") === "file", "kosong jadi file");
    const uri = buildSlotLabelUri(1, "Foto Liburan.JPG");
    assert(uri === "naze-preset://slot/1/Foto-Liburan.JPG", "uri: " + uri);
    assert(buildSlotLabelUri(2, "../jahat").indexOf("..") === -1, "label tersanitasi");
  });

  /* ===== State machine sesi (murni) ===== */

  test("SES-1 createPresetSessionState PB1: satu slot foto, status collecting", () => {
    const r = createPresetSessionState({
      id: "uji-1",
      ownerJid: "100@s.whatsapp.net",
      chatJid: "100@s.whatsapp.net",
      fileName: "pb1.xml",
      xmlText: REAL_AM_EXPORT_FIXTURE,
      now: 1000,
    });
    assert(r.ok === true, "ok: " + r.error);
    assert(r.state.promptSlotIndexes.length === 1, "satu slot foto");
    assert(r.state.promptSlotIndexes[0] === 0, "indeks slot 0");
    assert(r.state.status === "collecting", "status");
    assert(r.state.cursor === 0, "kursor awal");
    assert(r.state.slots.length === 1, "slots");
  });

  test("SES-2 proyek tanpa slot foto: status ready, tidak ada prompt", () => {
    const r = createPresetSessionState({
      id: "uji-2",
      ownerJid: "100@s.whatsapp.net",
      chatJid: "100@s.whatsapp.net",
      fileName: "kosong.xml",
      xmlText: XML_NO_SLOT_FIXTURE,
      now: 1000,
    });
    assert(r.ok === true, "ok");
    assert(r.state.status === "ready", "status ready");
    assert(r.state.promptSlotIndexes.length === 0, "tanpa prompt");
    assert(currentPrompt(r.state) === null, "prompt null");
  });

  test("SES-3 PB19: tiga slot foto", () => {
    const r = createPresetSessionState({
      id: "uji-3",
      ownerJid: "100@s.whatsapp.net",
      chatJid: "100@s.whatsapp.net",
      fileName: "pb19.xml",
      xmlText: REAL_AM_IMPORTED_PATH_FIXTURE,
      now: 1000,
    });
    assert(r.ok === true, "ok");
    assert(r.state.promptSlotIndexes.length === 3, "tiga slot: " + r.state.promptSlotIndexes.length);
  });

  test("SES-4 validateMediaForPrompt: jenis, ukuran, dan status", () => {
    const r = createPresetSessionState({
      id: "uji-4",
      ownerJid: "100@s.whatsapp.net",
      chatJid: "100@s.whatsapp.net",
      fileName: "pb1.xml",
      xmlText: REAL_AM_EXPORT_FIXTURE,
      limits: { mediaMaxBytes: 20 },
      now: 1000,
    });
    assert(r.ok === true, "ok");
    const state = r.state;
    const ok = validateMediaForPrompt(state, jpegBytes(), "foto.jpg", 2000);
    assert(ok.ok === true, "jpeg diterima: " + ok.error);
    assert(ok.slotNumber === 1, "nomor slot");
    const wrong = validateMediaForPrompt(state, zipBytes(), "x.zip", 2000);
    assert(wrong.ok === false, "zip ditolak");
    const video = validateMediaForPrompt(state, Buffer.from([0, 0, 0, 0x1a, 0x45, 0xd3, 0xa3]), "v.mp4", 2000);
    assert(video.ok === false, "byte video ditolak: " + video.error);
    const big = validateMediaForPrompt(state, Buffer.concat([jpegBytes(), jpegBytes(), jpegBytes(), jpegBytes()]), "besar.jpg", 2000);
    assert(big.ok === false, "ukuran melebihi batas");
    finishPresetSessionState(state, 3000);
    const none = validateMediaForPrompt(state, jpegBytes(), "y.jpg", 3000);
    assert(none.ok === false, "tanpa prompt");
  });

  test("SES-5 recordSlotMedia memajukan kursor dan buildFinalReplacements benar", () => {
    const r = createPresetSessionState({
      id: "uji-5",
      ownerJid: "100@s.whatsapp.net",
      chatJid: "100@s.whatsapp.net",
      fileName: "pb19.xml",
      xmlText: REAL_AM_IMPORTED_PATH_FIXTURE,
      now: 1000,
    });
    const state = r.state;
    const rec = recordSlotMedia(
      state,
      { fileName: "satu.png", size: 100, width: 10, height: 10, ext: "png" },
      "/tmp/satu.png",
      1500
    );
    assert(rec.ok === true, "ok: " + rec.error);
    assert(state.cursor === 1, "kursor 1");
    assert(state.status === "collecting", "masih collecting");
    const rep = state.replacements[0];
    assert(rep.slotNumber === 1, "slot 1");
    assert(rep.toUri === "naze-preset://slot/1/satu.png", "label uri: " + rep.toUri);
    assert(rep.fromUri === PB19_SLOT1_URI, "fromUri");
    const finals = buildFinalReplacements(state);
    assert(finals.length === 1, "satu final");
    assert(finals[0].filename === "satu.png", "filename");
    assert(finals[0].size === 100, "size");
    recordSlotMedia(state, { fileName: "dua.png", size: 200 }, "/tmp/dua.png", 1600);
    recordSlotMedia(state, { fileName: "tiga.png", size: 300 }, "/tmp/tiga.png", 1700);
    assert(state.status === "ready", "ready setelah semua slot");
    assert(state.replacements.length === 3, "tiga rekaman");
  });

  test("SES-6 skipCurrentPrompt memajukan dan berakhir siap", () => {
    const r = createPresetSessionState({
      id: "uji-6",
      ownerJid: "100@s.whatsapp.net",
      chatJid: "100@s.whatsapp.net",
      fileName: "pb19.xml",
      xmlText: REAL_AM_IMPORTED_PATH_FIXTURE,
      now: 1000,
    });
    const state = r.state;
    assert(skipCurrentPrompt(state, 1100).ok === true, "skip 1");
    assert(skipCurrentPrompt(state, 1200).ok === true, "skip 2");
    assert(skipCurrentPrompt(state, 1300).ok === true, "skip 3");
    assert(state.status === "ready", "ready");
    assert(skipCurrentPrompt(state, 1400).ok === false, "skip tanpa slot ditolak");
    assert(state.replacements.length === 0, "tanpa rekaman");
  });

  test("SES-7 isSessionExpired mengikuti TTL", () => {
    const r = createPresetSessionState({
      id: "uji-7",
      ownerJid: "100@s.whatsapp.net",
      chatJid: "100@s.whatsapp.net",
      fileName: "pb1.xml",
      xmlText: REAL_AM_EXPORT_FIXTURE,
      limits: { sessionTtlMs: 1000 },
      now: 1000,
    });
    assert(isSessionExpired(r.state, 1500) === false, "belum kedaluwarsa");
    assert(isSessionExpired(r.state, 2500) === true, "kedaluwarsa");
    assert(isSessionExpired(null, 0) === true, "state null");
  });

  test("SES-8 dua state sesi terisolasi", () => {
    const a = createPresetSessionState({
      id: "uji-a",
      ownerJid: "111@s.whatsapp.net",
      chatJid: "111@s.whatsapp.net",
      fileName: "pb19.xml",
      xmlText: REAL_AM_IMPORTED_PATH_FIXTURE,
      now: 1000,
    }).state;
    const b = createPresetSessionState({
      id: "uji-b",
      ownerJid: "222@s.whatsapp.net",
      chatJid: "222@s.whatsapp.net",
      fileName: "pb19.xml",
      xmlText: REAL_AM_IMPORTED_PATH_FIXTURE,
      now: 1000,
    }).state;
    recordSlotMedia(a, { fileName: "milik-a.png", size: 10 }, "/tmp/a.png", 1100);
    assert(a.cursor === 1, "a maju");
    assert(b.cursor === 0, "b tidak ikut maju");
    assert(a.replacements.length === 1, "a merekam");
    assert(b.replacements.length === 0, "b tetap kosong");
    skipCurrentPrompt(b, 1200);
    assert(a.replacements.length === 1, "a tidak terpengaruh skip b");
  });

  test("SES-9 teks antarmuka memuat ringkasan dan instruksi", () => {
    const r = createPresetSessionState({
      id: "uji-9",
      ownerJid: "100@s.whatsapp.net",
      chatJid: "100@s.whatsapp.net",
      fileName: "pb1.xml",
      xmlText: REAL_AM_EXPORT_FIXTURE,
      now: 1000,
    });
    const summary = buildSummaryText(r.state);
    assert(summary.includes("Preset Diterima"), "ringkasan: " + summary.slice(0, 40));
    assert(summary.includes("Proyek Baru 1"), "judul");
    const prompt = buildPromptText(r.state);
    assert(prompt.includes("Foto 1"), "prompt foto 1");
    const instructions = buildInstructionsText(r.state, "hasil.xml", ["FOTO-1-foto.jpg"]);
    assert(instructions.includes("Ganti Media"), "instruksi ganti media");
    assert(instructions.includes("BUKAN jaminan"), "peringatan jujur: " + instructions.slice(0, 60));
  });

  test("SES-10 cancelPresetSessionState menandai dibatalkan", () => {
    const r = createPresetSessionState({
      id: "uji-10",
      ownerJid: "100@s.whatsapp.net",
      chatJid: "100@s.whatsapp.net",
      fileName: "pb1.xml",
      xmlText: REAL_AM_EXPORT_FIXTURE,
      now: 1000,
    });
    cancelPresetSessionState(r.state, 1200);
    assert(r.state.status === "cancelled", "status cancelled");
  });

  /* ===== Manajer sesi (fs) ===== */

  const USER_A = "111@s.whatsapp.net";
  const USER_B = "222@s.whatsapp.net";

  function startPb1Session(user, chat) {
    return startPresetSession({
      ownerJid: user,
      chatJid: chat || user,
      fileName: "pb1.xml",
      xmlText: REAL_AM_EXPORT_FIXTURE,
    });
  }

  await testAsync("FSM-1 startPresetSession menyimpan sesi per pengguna", async () => {
    const s = startPb1Session(USER_A);
    assert(s.ok === true, "ok: " + s.error);
    const got = getPresetSession(USER_A);
    assert(got && got.state, "sesi tersedia");
    assert(got.state.ownerJid === USER_A, "pemilik");
    const again = startPb1Session(USER_A);
    assert(again.ok === true, "ganti sesi ok");
    finishAndCleanup(USER_A);
    assert(getPresetSession(USER_A) === null, "bersih setelah finish");
  });

  await testAsync("FSM-2 alur penuh PB1: media, selesai, dokumen terkirim, sesi bersih", async () => {
    const s = startPb1Session(USER_A);
    assert(s.ok === true, "ok: " + s.error);
    const media = mediaMessage(jpegBytes(), USER_A);
    const handled = await handlePresetMessage(media, null);
    assert(handled === true, "media dikonsumsi sesi");
    const state = getPresetSession(USER_A).state;
    assert(state.status === "ready", "ready: " + state.status);
    const done = fakeMessage({ sender: USER_A, body: "selesai" });
    const handled2 = await handlePresetMessage(done, null);
    assert(handled2 === true, "selesai dikonsumsi");
    const docs = done.replies.filter((x) => x.type === "document");
    assert(docs.length === 2, "dua dokumen (zip+xml): " + docs.length);
    assert(docs[0].name.endsWith("-media.zip"), "nama zip: " + docs[0].name);
    assert(docs[1].name.endsWith(".xml"), "nama xml: " + docs[1].name);
    const zipEntries = new AdmZip(docs[0].doc).getEntries().map((e) => e.entryName);
    assert(zipEntries.includes("BACA-DULU.txt"), "instruksi dalam zip");
    assert(zipEntries.some((n) => n.startsWith("FOTO-1-")), "media dalam zip: " + JSON.stringify(zipEntries));
    assert(zipEntries.some((n) => n.endsWith(".xml")), "xml dalam zip");
    const xmlOut = bytesText(docs[1].doc);
    assert(xmlOut.includes("naze-preset://slot/1/"), "label uri dalam xml");
    assert(!xmlOut.includes(PB1_SLOT_URI), "uri lama terganti");
    assert(done.replies.some((x) => x.type === "text" && x.text.includes("CARA MEMAKAI")), "instruksi terkirim");
    assert(getPresetSession(USER_A) === null, "sesi dibersihkan");
  });

  await testAsync("FSM-3 pesan teks biasa tidak dikonsumsi sesi", async () => {
    const s = startPb1Session(USER_A);
    assert(s.ok === true, "ok");
    const plain = fakeMessage({ sender: USER_A, body: "halo apa kabar" });
    const handled = await handlePresetMessage(plain, null);
    assert(handled === false, "tidak dikonsumsi");
    assert(getPresetSession(USER_A) !== null, "sesi tetap ada");
    finishAndCleanup(USER_A);
  });

  await testAsync("FSM-4 media jenis salah ditolak tanpa memajukan slot", async () => {
    const s = startPb1Session(USER_A);
    assert(s.ok === true, "ok");
    const bad = mediaMessage(zipBytes(), USER_A);
    const handled = await handlePresetMessage(bad, null);
    assert(handled === true, "ditangani");
    const state = getPresetSession(USER_A).state;
    assert(state.cursor === 0, "kursor tetap 0");
    assert(state.replacements.length === 0, "tidak merekam");
    assert(bad.replies.some((x) => x.text.includes("Media Ditolak")), "pesan penolakan");
    finishAndCleanup(USER_A);
  });

  await testAsync("FSM-5 skip memajukan prompt", async () => {
    const s = startPresetSession({
      ownerJid: USER_A,
      chatJid: USER_A,
      fileName: "pb19.xml",
      xmlText: REAL_AM_IMPORTED_PATH_FIXTURE,
    });
    assert(s.ok === true, "ok");
    const skip = fakeMessage({ sender: USER_A, body: "lewati" });
    const handled = await handlePresetMessage(skip, null);
    assert(handled === true, "dikonsumsi");
    const state = getPresetSession(USER_A).state;
    assert(state.cursor === 1, "kursor 1: " + state.cursor);
    assert(skip.replies.some((x) => x.text.includes("Foto 1")), "menyebut slot dilewati");
    assert(skip.replies.some((x) => x.text.includes("Foto 2")), "prompt berikutnya");
    finishAndCleanup(USER_A);
  });

  await testAsync("FSM-6 batal menghapus sesi", async () => {
    const s = startPb1Session(USER_A);
    assert(s.ok === true, "ok");
    const cancel = fakeMessage({ sender: USER_A, body: "batal" });
    const handled = await handlePresetMessage(cancel, null);
    assert(handled === true, "dikonsumsi");
    assert(getPresetSession(USER_A) === null, "sesi hilang");
    assert(cancel.replies.some((x) => x.text.includes("dibatalkan")), "pesan batal");
  });

  await testAsync("FSM-7 pesan dari chat berbeda tidak dikonsumsi", async () => {
    const s = startPb1Session(USER_A, "111@s.whatsapp.net");
    assert(s.ok === true, "ok");
    const other = fakeMessage({ sender: USER_A, chat: "999@g.us", body: "halo" });
    const handled = await handlePresetMessage(other, null);
    assert(handled === false, "chat lain tidak dikonsumsi");
    assert(getPresetSession(USER_A) !== null, "sesi tetap");
    finishAndCleanup(USER_A);
  });

  await testAsync("FSM-8 sesi kedaluwarsa disapu bersih", async () => {
    const s = startPb1Session(USER_A);
    assert(s.ok === true, "ok");
    const state = getPresetSession(USER_A).state;
    state.updatedAt -= state.limits.sessionTtlMs + 1000;
    const next = fakeMessage({ sender: USER_A, body: "selesai" });
    const handled = await handlePresetMessage(next, null);
    assert(handled === false, "sesi kedaluwarsa tidak diproses");
    assert(getPresetSession(USER_A) === null, "sesi disapu");
  });

  await testAsync("FSM-9 dua pengguna paralel tidak tertukar", async () => {
    const sa = startPb1Session(USER_A);
    const sb = startPb1Session(USER_B);
    assert(sa.ok && sb.ok, "kedua sesi mulai");
    assert(sa.state.id !== sb.state.id, "id berbeda");
    const mediaA = mediaMessage(jpegBytes(), USER_A);
    assert((await handlePresetMessage(mediaA, null)) === true, "media A");
    let a = getPresetSession(USER_A).state;
    let b = getPresetSession(USER_B).state;
    assert(a.replacements.length === 1, "A merekam");
    assert(b.replacements.length === 0, "B belum");
    const mediaB = mediaMessage(pngBytes(), USER_B);
    assert((await handlePresetMessage(mediaB, null)) === true, "media B");
    a = getPresetSession(USER_A).state;
    b = getPresetSession(USER_B).state;
    assert(a.replacements.length === 1 && b.replacements.length === 1, "masing-masing satu");
    assert(a.replacements[0].savedFile !== b.replacements[0].savedFile, "berkas terpisah");
    cancelPresetSession(USER_A);
    assert(getPresetSession(USER_A) === null, "A batal");
    assert(getPresetSession(USER_B) !== null, "B tetap aktif");
    finishAndCleanup(USER_B);
  });

  await testAsync("FSM-10 PB19 selesai lebih awal: slot tersisa dipertahankan", async () => {
    const s = startPresetSession({
      ownerJid: USER_A,
      chatJid: USER_A,
      fileName: "pb19.xml",
      xmlText: REAL_AM_IMPORTED_PATH_FIXTURE,
    });
    assert(s.ok === true, "ok");
    const media = mediaMessage(jpegBytes(), USER_A);
    assert((await handlePresetMessage(media, null)) === true, "media 1");
    const done = fakeMessage({ sender: USER_A, body: "done" });
    assert((await handlePresetMessage(done, null)) === true, "selesai");
    const docs = done.replies.filter((x) => x.type === "document");
    assert(docs.length === 2, "zip dan xml");
    const xmlOut = bytesText(docs[1].doc);
    assert(xmlOut.includes("naze-preset://slot/1/"), "slot 1 diganti");
    assert(xmlOut.includes(PB19_SLOT2_URI), "slot 2 asli utuh");
    assert(xmlOut.includes(PB19_SLOT3_URI), "slot 3 asli utuh");
    const zipEntries = new AdmZip(docs[0].doc).getEntries().map((e) => e.entryName);
    assert(zipEntries.filter((n) => n.startsWith("FOTO-")).length === 1, "satu media: " + JSON.stringify(zipEntries));
    assert(getPresetSession(USER_A) === null, "bersih");
  });

  await testAsync("FSM-11 buildSessionOutput menolak tanpa sesi", async () => {
    const out = await buildSessionOutput("tidak-ada@s.whatsapp.net");
    assert(out.ok === false, "tanpa sesi ditolak");
  });

  /* ===== Plugin .preset ===== */

  test("PLG-1 konfigurasi plugin sesuai konvensi", () => {
    if (!pluginConfigRef) {
      skipTest("PLG-1", "plugin tidak dapat diimpor");
      return;
    }
    assert(pluginConfigRef.name === "preset", "nama");
    assert(pluginConfigRef.category === "tools", "kategori");
    assert(pluginConfigRef.isEnabled === true, "aktif");
    assert(typeof pluginConfigRef.cooldown === "number" && pluginConfigRef.cooldown > 0, "cooldown");
    assert(Array.isArray(pluginConfigRef.alias) && pluginConfigRef.alias.includes("preset-instan"), "alias");
  });

  await testAsync("PLG-2 tanpa dokumen dan tanpa URL menampilkan bantuan", async () => {
    if (!pluginHandlerRef) {
      skipTest("PLG-2", "plugin tidak dapat diimpor");
      return;
    }
    const m = fakeMessage({ sender: USER_A });
    await pluginHandlerRef(m, {});
    assert(m.replies.length === 1, "satu balasan");
    assert(m.replies[0].text.includes("Preset Instan"), "bantuan");
  });

  await testAsync("PLG-3 URL tidak aman ditolak tanpa permintaan jaringan", async () => {
    if (!pluginHandlerRef) {
      skipTest("PLG-3", "plugin tidak dapat diimpor");
      return;
    }
    const m = fakeMessage({ sender: USER_A, text: "http://localhost/rahasia" });
    await pluginHandlerRef(m, {});
    assert(m.replies.some((x) => x.text.includes("Tautan Ditolak")), "ditolak: " + JSON.stringify(m.replies.map((r) => r.text.slice(0, 30))));
  });

  await testAsync("PLG-4 tautan aman tanpa kunci API menjelaskan keterbatasan", async () => {
    if (!pluginHandlerRef) {
      skipTest("PLG-4", "plugin tidak dapat diimpor");
      return;
    }
    if (hasObscuraKey) {
      skipTest("PLG-4", "kunci API obscura aktif; jalur ini memerlukan kunci kosong");
      return;
    }
    const m = fakeMessage({ sender: USER_A, text: "https://alightcreative.com/am/share/abc" });
    await pluginHandlerRef(m, {});
    assert(m.replies.some((x) => x.text.includes("Metadata Tidak Tersedia")), "penjelasan metadata");
  });

  await testAsync("PLG-5 dokumen XML memulai sesi dengan ringkasan slot", async () => {
    if (!pluginHandlerRef) {
      skipTest("PLG-5", "plugin tidak dapat diimpor");
      return;
    }
    const m = documentMessage(xmlBytes(REAL_AM_EXPORT_FIXTURE), "pb1.xml", USER_A);
    await pluginHandlerRef(m, {});
    assert(m.replies.some((x) => x.text.includes("Preset Diterima")), "ringkasan: " + JSON.stringify(m.replies.map((r) => r.text.slice(0, 24))));
    assert(m.replies.some((x) => x.text.includes("Foto 1")), "prompt foto 1");
    assert(getPresetSession(USER_A) !== null, "sesi aktif");
    finishAndCleanup(USER_A);
  });

  await testAsync("PLG-6 dokumen ZIP valid memulai sesi", async () => {
    if (!pluginHandlerRef) {
      skipTest("PLG-6", "plugin tidak dapat diimpor");
      return;
    }
    const zip = new AdmZip();
    zip.addFile("project.xml", xmlBytes(REAL_AM_EXPORT_FIXTURE));
    const m = documentMessage(zip.toBuffer(), "paket.zip", USER_A);
    await pluginHandlerRef(m, {});
    assert(m.replies.some((x) => x.text.includes("Preset Diterima")), "sesi mulai: " + JSON.stringify(m.replies.map((r) => r.text.slice(0, 30))));
    assert(getPresetSession(USER_A) !== null, "sesi aktif");
    finishAndCleanup(USER_A);
  });

  await testAsync("PLG-7 ZIP dengan nama entri traversal ditolak", async () => {
    if (!pluginHandlerRef) {
      skipTest("PLG-7", "plugin tidak dapat diimpor");
      return;
    }
    const zip = new AdmZip();
    zip.addFile("../../evil.xml", xmlBytes(REAL_AM_EXPORT_FIXTURE));
    const m = documentMessage(zip.toBuffer(), "jahat.zip", USER_A);
    await pluginHandlerRef(m, {});
    assert(m.replies.some((x) => x.text.includes("Preset Ditolak")), "ditolak");
    assert(getPresetSession(USER_A) === null, "tanpa sesi");
  });

  await testAsync("PLG-8 ZIP tanpa berkas XML ditolak", async () => {
    if (!pluginHandlerRef) {
      skipTest("PLG-8", "plugin tidak dapat diimpor");
      return;
    }
    const zip = new AdmZip();
    zip.addFile("readme.txt", xmlBytes("bukan xml"));
    const m = documentMessage(zip.toBuffer(), "kosong.zip", USER_A);
    await pluginHandlerRef(m, {});
    assert(m.replies.some((x) => x.text.includes("Preset Ditolak")), "ditolak");
  });

  await testAsync("PLG-9 dokumen non-XML/non-ZIP ditolak berdasar signature", async () => {
    if (!pluginHandlerRef) {
      skipTest("PLG-9", "plugin tidak dapat diimpor");
      return;
    }
    const m = documentMessage(jpegBytes(), "bukan-preset.xml", USER_A);
    await pluginHandlerRef(m, {});
    assert(m.replies.some((x) => x.text.includes("Format Tidak Dikenali")), "ditolak");
    assert(getPresetSession(USER_A) === null, "tanpa sesi");
  });

  await testAsync("PLG-10 dokumen XML rusak ditolak pada analisis", async () => {
    if (!pluginHandlerRef) {
      skipTest("PLG-10", "plugin tidak dapat diimpor");
      return;
    }
    const m = documentMessage(xmlBytes("<scene><shape id=\"1\"></scene>"), "rusak.xml", USER_A);
    await pluginHandlerRef(m, {});
    assert(m.replies.some((x) => x.text.includes("Analisis Gagal") || x.text.includes("Preset Ditolak")), "gagal: " + JSON.stringify(m.replies.map((r) => r.text.slice(0, 30))));
    assert(getPresetSession(USER_A) === null, "tanpa sesi");
  });

  await testAsync("PLG-11 sesi aktif: .preset menampilkan status", async () => {
    if (!pluginHandlerRef) {
      skipTest("PLG-11", "plugin tidak dapat diimpor");
      return;
    }
    const s = startPb1Session(USER_A);
    assert(s.ok === true, "ok");
    const m = fakeMessage({ sender: USER_A });
    await pluginHandlerRef(m, {});
    assert(m.replies.some((x) => x.text.includes("Sesi Preset Masih Aktif")), "status: " + JSON.stringify(m.replies.map((r) => r.text.slice(0, 30))));
    finishAndCleanup(USER_A);
  });

  await testAsync("PLG-12 alur ujung-ke-ujung: plugin mulai, sesi mengumpulkan, hasil terkirim", async () => {
    if (!pluginHandlerRef) {
      skipTest("PLG-12", "plugin tidak dapat diimpor");
      return;
    }
    const doc = documentMessage(xmlBytes(REAL_AM_EXPORT_FIXTURE), "pb1.xml", USER_B);
    await pluginHandlerRef(doc, {});
    assert(getPresetSession(USER_B) !== null, "sesi B mulai");
    const media = mediaMessage(pngBytes(), USER_B);
    assert((await handlePresetMessage(media, null)) === true, "media B");
    const done = fakeMessage({ sender: USER_B, body: "selesai" });
    assert((await handlePresetMessage(done, null)) === true, "selesai B");
    const docs = done.replies.filter((x) => x.type === "document");
    assert(docs.length === 2, "zip+xml terkirim");
    const zipEntries = new AdmZip(docs[0].doc).getEntries().map((e) => e.entryName);
    assert(zipEntries.some((n) => n.startsWith("FOTO-1-")), "media pengganti terpaket");
    assert(getPresetSession(USER_B) === null, "sesi bersih");
  });

  return {
    total,
    passed: total - failures.length - skipped,
    failed: failures.length,
    skipped,
    failures,
  };
}

// ===== RUNNER (khusus Node ESM; harness memotong di penanda ini) =====

import { parseAlightMotionProject } from "../src/lib/naze-am-preset/parser.js";
import { replaceAssets } from "../src/lib/naze-am-preset/remixer.js";
import {
  analyzePresetText,
  validatePresetFileInput,
  buildReplacement,
  remixPreset,
  buildRemixDownloadName,
  normalizeReplacementUri,
  PRESET_MAX_BYTES,
} from "../src/lib/naze-am-preset/workflow.js";
import { validateAlightMotionXml } from "../src/lib/naze-am-preset/xml-validation.js";
import {
  DEFAULT_PRESET_LIMITS,
  resolvePresetLimits,
  sniffBufferKind,
  isSafeAlightShareUrl,
  isSafeZipEntryName,
  sanitizeName,
  buildSlotLabelUri,
  createPresetSessionState,
  currentPrompt,
  isSessionExpired,
  validateMediaForPrompt,
  recordSlotMedia,
  skipCurrentPrompt,
  cancelPresetSessionState,
  finishPresetSessionState,
  buildFinalReplacements,
  buildSummaryText,
  buildPromptText,
  buildInstructionsText,
} from "../src/lib/naze-preset-session-core.js";
import {
  startPresetSession,
  getPresetSession,
  cancelPresetSession,
  sweepExpiredPresetSessions,
  buildSessionOutput,
  finishAndCleanup,
  handlePresetMessage,
} from "../src/lib/naze-preset-session.js";
import AdmZip from "adm-zip";

let pluginHandlerRef = null;
let pluginConfigRef = null;
try {
  const plugin = await import("../plugins/tools/preset.js");
  pluginHandlerRef = plugin.handler;
  pluginConfigRef = plugin.config;
} catch (e) {
  console.error("Plugin preset tidak dapat diimpor: " + e);
}

let hasObscuraKey = false;
try {
  const cfg = (await import("../config.js")).default;
  hasObscuraKey = !!cfg?.APIkey?.obscura;
} catch {
  hasObscuraKey = false;
}

const result = await runPresetInstanTests();
console.log(
  "Hasil Preset Instan (Node): total " +
    result.total +
    " | lulus " +
    result.passed +
    " | gagal " +
    result.failed +
    " | dilewati " +
    result.skipped
);
for (const f of result.failures) {
  console.error("GAGAL [" + f.name + "] " + f.error);
}
if (result.failed > 0) {
  process.exitCode = 1;
}

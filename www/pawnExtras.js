// ==================================================
// PawnStudio - Extras editor PAWN (v1.5.9)
// ==================================================
// 1. Auto-complete konstanta SA-MP (INVALID_PLAYER_ID, DIALOG_STYLE_*, dst)
// 2. Petunjuk parameter saat kursor di dalam kurung fungsi
// 3. Hover di nama fungsi / konstanta
//
// Nama konstanta diambil dari include bawaan (a_samp, a_players, dst).
// Daftar fungsi + parameter dipakai ulang dari getFunctionSuggestions()
// di pawnCompletion.js, jadi file ini tidak menyimpan salinan sendiri.
//
// Panggil registerPawnExtras() SETELAH registerPawnCompletion() dan
// sebelum monaco.editor.create().

(function () {
  var CONST_NAMES = (
    "BULLET_HIT_TYPE_NONE BULLET_HIT_TYPE_OBJECT BULLET_HIT_TYPE_PLAYER " +
    "BULLET_HIT_TYPE_PLAYER_OBJECT BULLET_HIT_TYPE_VEHICLE CAMERA_CUT CAMERA_MOVE " +
    "CARMODTYPE_EXHAUST CARMODTYPE_FRONT_BUMPER CARMODTYPE_HOOD CARMODTYPE_HYDRAULICS " +
    "CARMODTYPE_LAMPS CARMODTYPE_NITRO CARMODTYPE_REAR_BUMPER CARMODTYPE_ROOF " +
    "CARMODTYPE_SIDESKIRT CARMODTYPE_SPOILER CARMODTYPE_STEREO CARMODTYPE_VENT_LEFT " +
    "CARMODTYPE_VENT_RIGHT CARMODTYPE_WHEELS CLICK_SOURCE_SCOREBOARD DIALOG_STYLE_INPUT " +
    "DIALOG_STYLE_LIST DIALOG_STYLE_MSGBOX DIALOG_STYLE_PASSWORD DIALOG_STYLE_TABLIST " +
    "DIALOG_STYLE_TABLIST_HEADERS DOWNLOAD_REQUEST_EMPTY DOWNLOAD_REQUEST_MODEL_FILE " +
    "DOWNLOAD_REQUEST_TEXTURE_FILE EDIT_RESPONSE_CANCEL EDIT_RESPONSE_FINAL EDIT_RESPONSE_UPDATE " +
    "FIGHT_STYLE_BOXING FIGHT_STYLE_ELBOW FIGHT_STYLE_GRABKICK FIGHT_STYLE_KNEEHEAD " +
    "FIGHT_STYLE_KUNGFU FIGHT_STYLE_NORMAL HTTP_ERROR_BAD_HOST HTTP_ERROR_CANT_CONNECT " +
    "HTTP_ERROR_CANT_WRITE HTTP_ERROR_CONTENT_TOO_BIG HTTP_ERROR_MALFORMED_RESPONSE " +
    "HTTP_ERROR_NO_SOCKET HTTP_GET HTTP_HEAD HTTP_POST INVALID_3DTEXT_ID INVALID_ACTOR_ID " +
    "INVALID_GANG_ZONE INVALID_MENU INVALID_OBJECT_ID INVALID_PLAYER_3DTEXT_ID INVALID_PLAYER_ID " +
    "INVALID_PLAYER_TEXT_DRAW INVALID_TEXT_DRAW INVALID_VEHICLE_ID KEY_ACTION KEY_ANALOG_DOWN " +
    "KEY_ANALOG_LEFT KEY_ANALOG_RIGHT KEY_ANALOG_UP KEY_CROUCH KEY_CTRL_BACK KEY_DOWN KEY_FIRE " +
    "KEY_HANDBRAKE KEY_JUMP KEY_LEFT KEY_LOOK_BEHIND KEY_LOOK_LEFT KEY_LOOK_RIGHT KEY_NO " +
    "KEY_RIGHT KEY_SECONDARY_ATTACK KEY_SPRINT KEY_SUBMISSION KEY_UP KEY_WALK KEY_YES " +
    "MAPICON_GLOBAL MAPICON_GLOBAL_CHECKPOINT MAPICON_LOCAL MAPICON_LOCAL_CHECKPOINT " +
    "MAX_3DTEXT_GLOBAL MAX_3DTEXT_PLAYER MAX_ACTORS MAX_CHATBUBBLE_LENGTH MAX_GANG_ZONES " +
    "MAX_MENUS MAX_OBJECTS MAX_PICKUPS MAX_PLAYERS MAX_PLAYER_ATTACHED_OBJECTS MAX_PLAYER_NAME " +
    "MAX_PLAYER_TEXT_DRAWS MAX_TEXT_DRAWS MAX_VEHICLES NO_TEAM OBJECT_MATERIAL_SIZE_128 " +
    "OBJECT_MATERIAL_SIZE_256 OBJECT_MATERIAL_SIZE_32 OBJECT_MATERIAL_SIZE_512 " +
    "OBJECT_MATERIAL_SIZE_64 OBJECT_MATERIAL_TEXT_ALIGN_CENTER OBJECT_MATERIAL_TEXT_ALIGN_LEFT " +
    "OBJECT_MATERIAL_TEXT_ALIGN_RIGHT PLAYER_MARKERS_MODE_GLOBAL PLAYER_MARKERS_MODE_OFF " +
    "PLAYER_MARKERS_MODE_STREAMED PLAYER_RECORDING_TYPE_DRIVER PLAYER_RECORDING_TYPE_NONE " +
    "PLAYER_RECORDING_TYPE_ONFOOT PLAYER_STATE_DRIVER PLAYER_STATE_ENTER_VEHICLE_DRIVER " +
    "PLAYER_STATE_ENTER_VEHICLE_PASSENGER PLAYER_STATE_EXIT_VEHICLE PLAYER_STATE_NONE " +
    "PLAYER_STATE_ONFOOT PLAYER_STATE_PASSENGER PLAYER_STATE_SPAWNED PLAYER_STATE_SPECTATING " +
    "PLAYER_STATE_WASTED PLAYER_VARTYPE_FLOAT PLAYER_VARTYPE_INT PLAYER_VARTYPE_NONE " +
    "PLAYER_VARTYPE_STRING SELECT_OBJECT_GLOBAL_OBJECT SELECT_OBJECT_PLAYER_OBJECT " +
    "SERVER_VARTYPE_FLOAT SERVER_VARTYPE_INT SERVER_VARTYPE_NONE SERVER_VARTYPE_STRING " +
    "SPECIAL_ACTION_CARRY SPECIAL_ACTION_CUFFED SPECIAL_ACTION_DANCE1 SPECIAL_ACTION_DANCE2 " +
    "SPECIAL_ACTION_DANCE3 SPECIAL_ACTION_DANCE4 SPECIAL_ACTION_DRINK_BEER " +
    "SPECIAL_ACTION_DRINK_SPRUNK SPECIAL_ACTION_DRINK_WINE SPECIAL_ACTION_DUCK " +
    "SPECIAL_ACTION_ENTER_VEHICLE SPECIAL_ACTION_EXIT_VEHICLE SPECIAL_ACTION_HANDSUP " +
    "SPECIAL_ACTION_NONE SPECIAL_ACTION_PISSING SPECIAL_ACTION_SITTING " +
    "SPECIAL_ACTION_SMOKE_CIGGY SPECIAL_ACTION_STOPUSECELLPHONE SPECIAL_ACTION_USECELLPHONE " +
    "SPECIAL_ACTION_USEJETPACK SPECTATE_MODE_FIXED SPECTATE_MODE_NORMAL SPECTATE_MODE_SIDE " +
    "TEXT_DRAW_FONT_MODEL_PREVIEW TEXT_DRAW_FONT_SPRITE_DRAW UNKNOWN_WEAPON " +
    "VEHICLE_MODEL_INFO_FRONTSEAT VEHICLE_MODEL_INFO_FRONT_BUMPER_Z VEHICLE_MODEL_INFO_PETROLCAP " +
    "VEHICLE_MODEL_INFO_REARSEAT VEHICLE_MODEL_INFO_REAR_BUMPER_Z VEHICLE_MODEL_INFO_SIZE " +
    "VEHICLE_MODEL_INFO_WHEELSFRONT VEHICLE_MODEL_INFO_WHEELSMID VEHICLE_MODEL_INFO_WHEELSREAR " +
    "VEHICLE_PARAMS_OFF VEHICLE_PARAMS_ON VEHICLE_PARAMS_UNSET WEAPONSKILL_AK47 " +
    "WEAPONSKILL_DESERT_EAGLE WEAPONSKILL_M4 WEAPONSKILL_MICRO_UZI WEAPONSKILL_MP5 " +
    "WEAPONSKILL_PISTOL WEAPONSKILL_PISTOL_SILENCED WEAPONSKILL_SAWNOFF_SHOTGUN " +
    "WEAPONSKILL_SHOTGUN WEAPONSKILL_SNIPERRIFLE WEAPONSKILL_SPAS12_SHOTGUN " +
    "WEAPONSTATE_LAST_BULLET WEAPONSTATE_MORE_BULLETS WEAPONSTATE_NO_BULLETS " +
    "WEAPONSTATE_RELOADING WEAPONSTATE_UNKNOWN WEAPON_AK47 WEAPON_BAT WEAPON_BOMB " +
    "WEAPON_BRASSKNUCKLE WEAPON_CAMERA WEAPON_CANE WEAPON_CHAINSAW WEAPON_COLLISION " +
    "WEAPON_COLT45 WEAPON_DEAGLE WEAPON_DILDO WEAPON_DILDO2 WEAPON_DROWN WEAPON_FIREEXTINGUISHER " +
    "WEAPON_FIST WEAPON_FLAMETHROWER WEAPON_FLOWER WEAPON_GOLFCLUB WEAPON_GRENADE " +
    "WEAPON_HEATSEEKER WEAPON_KATANA WEAPON_KNIFE WEAPON_M4 WEAPON_MINIGUN WEAPON_MOLTOV " +
    "WEAPON_MP5 WEAPON_NITESTICK WEAPON_PARACHUTE WEAPON_POOLSTICK WEAPON_RIFLE " +
    "WEAPON_ROCKETLAUNCHER WEAPON_SATCHEL WEAPON_SAWEDOFF WEAPON_SHOTGSPA WEAPON_SHOTGUN " +
    "WEAPON_SHOVEL WEAPON_SILENCED WEAPON_SNIPER WEAPON_SPRAYCAN WEAPON_TEARGAS WEAPON_TEC9 " +
    "WEAPON_UZI WEAPON_VEHICLE WEAPON_VIBRATOR WEAPON_VIBRATOR2"
  ).split(" ");

  // Urutan penting: prefix yang lebih spesifik ditaruh lebih dulu.
  var GROUPS = [
    ["INVALID_", "ID tidak valid"],
    ["MAX_", "Batas maksimum"],
    ["DIALOG_STYLE_", "Gaya dialog (ShowPlayerDialog)"],
    ["PLAYER_STATE_", "State player (GetPlayerState)"],
    ["PLAYER_MARKERS_MODE_", "Mode marker player"],
    ["PLAYER_VARTYPE_", "Tipe PVar"],
    ["PLAYER_RECORDING_", "Tipe rekaman"],
    ["SPECIAL_ACTION_", "Special action player"],
    ["WEAPONSKILL_", "Skill senjata"],
    ["WEAPONSTATE_", "Status senjata"],
    ["WEAPON_", "ID senjata"],
    ["KEY_", "Tombol (OnPlayerKeyStateChange)"],
    ["CAMERA_", "Mode kamera"],
    ["SPECTATE_", "Mode spectate"],
    ["MAPICON_", "Gaya ikon peta"],
    ["SERVER_VARTYPE_", "Tipe server var"],
    ["BULLET_HIT_", "Tipe target tembakan"],
    ["CLICK_SOURCE_", "Sumber klik"],
    ["EDIT_RESPONSE_", "Respons edit object"],
    ["VEHICLE_PARAMS_", "Parameter kendaraan"],
    ["VEHICLE_MODEL_INFO_", "Info model kendaraan"],
    ["FIGHT_STYLE_", "Gaya bertarung"],
    ["SELECT_OBJECT_", "Pemilihan object"],
    ["OBJECT_MATERIAL_", "Material object"],
    ["TEXT_DRAW_", "TextDraw"],
    ["CARMODTYPE_", "Tipe modifikasi kendaraan"],
    ["DOWNLOAD_REQUEST_", "Tipe permintaan download"],
    ["HTTP_", "HTTP"]
  ];

  var KEYWORD_ONLY = { "if": 1, "while": 1, "for": 1, "switch": 1, "return": 1, "sizeof": 1, "tagof": 1 };

  function groupOf(name) {
    for (var i = 0; i < GROUPS.length; i++) {
      if (name.indexOf(GROUPS[i][0]) === 0) return GROUPS[i][1];
    }
    return "Konstanta SA-MP";
  }

  var constMap = null;
  function getConstMap() {
    if (constMap) return constMap;
    constMap = {};
    CONST_NAMES.forEach(function (n) { constMap[n] = groupOf(n); });
    return constMap;
  }

  // name -> { params, doc }, dibangun sekali dari daftar di pawnCompletion.js
  var fnMap = null;
  function getFnMap() {
    if (fnMap) return fnMap;
    var map = {};
    if (typeof getFunctionSuggestions === "function") {
      var dummy = { startLineNumber: 1, endLineNumber: 1, startColumn: 1, endColumn: 1 };
      getFunctionSuggestions(dummy).forEach(function (s) {
        map[s.label] = { params: s.detail || "()", doc: s.documentation || "" };
      });
    }
    fnMap = map;
    return fnMap;
  }

  // "(playerid, Float:x, {Float,_}:...)" -> ["playerid", "Float:x", "{Float,_}:..."]
  function splitParams(str) {
    var inner = String(str || "").trim();
    if (inner.charAt(0) === "(" && inner.charAt(inner.length - 1) === ")") inner = inner.slice(1, -1);
    var out = [], depth = 0, cur = "";
    for (var i = 0; i < inner.length; i++) {
      var c = inner.charAt(i);
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") depth--;
      if (c === "," && depth === 0) { out.push(cur.trim()); cur = ""; }
      else cur += c;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  // Cari pemanggilan fungsi paling dalam yang kurungnya belum ditutup di akhir
  // teks. Komentar dan isi string diabaikan. Hasil: { name, index } atau null.
  function findCallContext(text, known) {
    var stack = [];
    var lastIdent = "";
    var i = 0, n = text.length;

    while (i < n) {
      var c = text.charAt(i), d = text.charAt(i + 1);

      if (c === "/" && d === "/") { while (i < n && text.charAt(i) !== "\n") i++; continue; }
      if (c === "/" && d === "*") {
        i += 2;
        while (i < n && !(text.charAt(i) === "*" && text.charAt(i + 1) === "/")) i++;
        i += 2;
        continue;
      }
      if (c === '"' || c === "'") {
        var q = c;
        i++;
        while (i < n && text.charAt(i) !== q && text.charAt(i) !== "\n") {
          if (text.charAt(i) === "^" || text.charAt(i) === "\\") i++;
          i++;
        }
        i++;
        lastIdent = "";
        continue;
      }
      if (/[A-Za-z_@]/.test(c)) {
        var j = i;
        while (j < n && /[A-Za-z0-9_@]/.test(text.charAt(j))) j++;
        lastIdent = text.slice(i, j);
        i = j;
        continue;
      }
      if (c === " " || c === "\t" || c === "\r" || c === "\n") { i++; continue; }

      if (c === "(") {
        stack.push({ name: lastIdent, commas: 0, paren: true });
      } else if (c === "[" || c === "{") {
        stack.push({ name: "", commas: 0, paren: false });
      } else if (c === ")" || c === "]" || c === "}") {
        stack.pop();
      } else if (c === ",") {
        if (stack.length) stack[stack.length - 1].commas++;
      } else if (c === ";") {
        var top = stack[stack.length - 1];
        if (!(top && top.paren && top.name === "for")) stack = [];
      }
      lastIdent = "";
      i++;
    }

    for (var k = stack.length - 1; k >= 0; k--) {
      var e = stack[k];
      if (e.paren && e.name && !KEYWORD_ONLY[e.name] && known[e.name]) {
        return { name: e.name, index: e.commas };
      }
    }
    return null;
  }

  function registerPawnExtras() {
    try {
      var lang = monaco.languages;

      // --- 1. konstanta ---
      lang.registerCompletionItemProvider("pawn", {
        provideCompletionItems: function (model, position) {
          var word = model.getWordUntilPosition(position);
          var range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
          };
          return {
            suggestions: CONST_NAMES.map(function (name) {
              return {
                label: name,
                kind: lang.CompletionItemKind.Constant,
                insertText: name,
                detail: groupOf(name),
                range: range
              };
            })
          };
        }
      });

      // --- 2. petunjuk parameter ---
      lang.registerSignatureHelpProvider("pawn", {
        signatureHelpTriggerCharacters: ["(", ","],
        signatureHelpRetriggerCharacters: [")"],
        provideSignatureHelp: function (model, position) {
          var map = getFnMap();
          var from = Math.max(1, position.lineNumber - 12);
          var text = model.getValueInRange({
            startLineNumber: from,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          });
          if (text.length > 4000) text = text.slice(-4000);

          var ctx = findCallContext(text, map);
          if (!ctx) return null;

          var fn = map[ctx.name];
          var params = splitParams(fn.params);
          var label = ctx.name + "(";
          var infos = [];
          for (var k = 0; k < params.length; k++) {
            var start = label.length;
            label += params[k];
            infos.push({ label: [start, label.length] });
            if (k < params.length - 1) label += ", ";
          }
          label += ")";

          return {
            value: {
              signatures: [{ label: label, documentation: fn.doc, parameters: infos }],
              activeSignature: 0,
              activeParameter: Math.min(ctx.index, Math.max(0, params.length - 1))
            },
            dispose: function () {}
          };
        }
      });

      // --- 3. hover ---
      lang.registerHoverProvider("pawn", {
        provideHover: function (model, position) {
          var w = model.getWordAtPosition(position);
          if (!w) return null;
          var range = new monaco.Range(position.lineNumber, w.startColumn, position.lineNumber, w.endColumn);
          var fn = getFnMap()[w.word];
          if (fn) {
            return {
              range: range,
              contents: [
                { value: "```pawn\n" + w.word + fn.params + "\n```" },
                { value: String(fn.doc) }
              ]
            };
          }
          var cm = getConstMap();
          if (cm[w.word]) {
            return { range: range, contents: [{ value: "`" + w.word + "`: " + cm[w.word] }] };
          }
          return null;
        }
      });
    } catch (e) {
      console.error("PawnExtras gagal didaftarkan:", e);
    }
  }

  window.registerPawnExtras = registerPawnExtras;
  window.PawnExtras = { splitParams: splitParams, findCallContext: findCallContext, groupOf: groupOf, names: CONST_NAMES };
})();

// ==================================================
// PawnStudio - Auto-complete / IntelliSense untuk PAWN
// ==================================================
// Daftarin completion provider ke Monaco biar muncul
// suggestion pas user ngetik kode PAWN.
//
// Panggil registerPawnCompletion() SEKALI, setelah
// registerPawnLanguage() dan sebelum monaco.editor.create().

function registerPawnCompletion() {
  monaco.languages.registerCompletionItemProvider("pawn", {
    triggerCharacters: ["."],

    provideCompletionItems: function (model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions = [
        ...getFunctionSuggestions(range),
        ...getSnippetSuggestions(range),
      ];

      return { suggestions };
    },
  });
}

// ============ Daftar Fungsi SA-MP / Open.MP Umum ============

function getFunctionSuggestions(range) {
  const K = monaco.languages.CompletionItemKind.Function;

  const functions = [
    // --- Player Info & Message ---
    { name: "SendClientMessage", params: "(playerid, color, const message[])", doc: "Kirim pesan berwarna ke satu player." },
    { name: "SendClientMessageToAll", params: "(color, const message[])", doc: "Kirim pesan berwarna ke semua player." },
    { name: "GetPlayerName", params: "(playerid, name[], len)", doc: "Ambil nickname player, simpan ke variabel name." },
    { name: "SetPlayerName", params: "(playerid, const name[])", doc: "Ganti nickname player." },
    { name: "GetPlayerPos", params: "(playerid, &Float:x, &Float:y, &Float:z)", doc: "Ambil koordinat posisi player." },
    { name: "SetPlayerPos", params: "(playerid, Float:x, Float:y, Float:z)", doc: "Set posisi player ke koordinat tertentu." },
    { name: "SetPlayerHealth", params: "(playerid, Float:health)", doc: "Set HP player." },
    { name: "GetPlayerHealth", params: "(playerid, &Float:health)", doc: "Ambil HP player saat ini." },
    { name: "SetPlayerArmour", params: "(playerid, Float:armour)", doc: "Set armor player." },
    { name: "SetPlayerScore", params: "(playerid, score)", doc: "Set skor player (muncul di scoreboard)." },
    { name: "GetPlayerScore", params: "(playerid)", doc: "Ambil skor player." },
    { name: "IsPlayerConnected", params: "(playerid)", doc: "Cek apakah player masih terkoneksi." },
    { name: "GetPlayerState", params: "(playerid)", doc: "Ambil state player (di darat, di kendaraan, spectate, dll)." },
    { name: "SetPlayerColor", params: "(playerid, color)", doc: "Set warna nama/marker player." },
    { name: "Kick", params: "(playerid)", doc: "Kick player dari server." },
    { name: "Ban", params: "(playerid)", doc: "Ban player dari server." },
    { name: "SpawnPlayer", params: "(playerid)", doc: "Spawn ulang player." },
    { name: "TogglePlayerControllable", params: "(playerid, toggle)", doc: "Kunci/lepas kontrol player (1/0)." },

    // --- Vehicle ---
    { name: "CreateVehicle", params: "(modelid, Float:x, Float:y, Float:z, Float:rotation, color1, color2, respawn_delay)", doc: "Buat kendaraan baru di posisi tertentu." },
    { name: "DestroyVehicle", params: "(vehicleid)", doc: "Hapus kendaraan dari map." },
    { name: "PutPlayerInVehicle", params: "(playerid, vehicleid, seatid)", doc: "Masukin player ke kendaraan di kursi tertentu." },
    { name: "GetPlayerVehicleID", params: "(playerid)", doc: "Ambil ID kendaraan yang lagi dinaiki player." },
    { name: "SetVehicleHealth", params: "(vehicleid, Float:health)", doc: "Set HP/kondisi kendaraan." },
    { name: "RepairVehicle", params: "(vehicleid)", doc: "Perbaiki kendaraan (full HP + hilangin kerusakan visual)." },

    // --- Timer ---
    { name: "SetTimer", params: "(const funcname[], interval, repeating)", doc: "Bikin timer yang manggil fungsi tertentu tiap interval (ms)." },
    { name: "SetTimerEx", params: "(const funcname[], interval, repeating, const format[], {Float,_}:...)", doc: "Sama seperti SetTimer, tapi bisa kirim parameter ke fungsi target." },
    { name: "KillTimer", params: "(timerid)", doc: "Hentikan timer yang sedang berjalan." },

    // --- Object / World ---
    { name: "CreateObject", params: "(modelid, Float:x, Float:y, Float:z, Float:rX, Float:rY, Float:rZ)", doc: "Buat object statis di dunia game." },
    { name: "CreatePickup", params: "(model, type, Float:x, Float:y, Float:z, virtualworld)", doc: "Buat pickup item di posisi tertentu." },
    { name: "SetPlayerVirtualWorld", params: "(playerid, worldid)", doc: "Pindahin player ke virtual world tertentu." },
    { name: "GetPlayerVirtualWorld", params: "(playerid)", doc: "Ambil virtual world player saat ini." },

    // --- Text Draw ---
    { name: "TextDrawCreate", params: "(Float:x, Float:y, const text[])", doc: "Buat textdraw baru di layar." },
    { name: "TextDrawShowForPlayer", params: "(playerid, text)", doc: "Tampilkan textdraw untuk satu player." },
    { name: "TextDrawHideForPlayer", params: "(playerid, text)", doc: "Sembunyikan textdraw untuk satu player." },

    // --- Dialog ---
    { name: "ShowPlayerDialog", params: "(playerid, dialogid, style, const caption[], const info[], const button1[], const button2[])", doc: "Tampilkan dialog box ke player." },

    // --- Utility ---
    { name: "format", params: "(output[], len, const format[], {Float,_}:...)", doc: "Format string, mirip sprintf." },
    { name: "random", params: "(max)", doc: "Ambil angka random dari 0 sampai max-1." },
    { name: "strval", params: "(const string[])", doc: "Konversi string ke integer." },
    { name: "floatstr", params: "(const string[])", doc: "Konversi string ke float." },
    { name: "print", params: "(const string[])", doc: "Cetak teks ke console server." },
    { name: "printf", params: "(const format[], {Float,_}:...)", doc: "Cetak teks berformat ke console server." },
  ];

  return functions.map((fn) => ({
    label: fn.name,
    kind: K,
    insertText: fn.name + "(",
    detail: fn.params,
    documentation: fn.doc,
    range: range,
  }));
}

// ============ Snippet Struktur Kode ============

function getSnippetSuggestions(range) {
  const K = monaco.languages.CompletionItemKind.Snippet;
  const InsertRule = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;

  const snippets = [
    {
      label: "if",
      insertText: "if (${1:condition})\n{\n\t${2}\n}",
      doc: "Struktur if statement",
    },
    {
      label: "ifelse",
      insertText: "if (${1:condition})\n{\n\t${2}\n}\nelse\n{\n\t${3}\n}",
      doc: "Struktur if-else statement",
    },
    {
      label: "for",
      insertText: "for (new ${1:i} = 0; ${1:i} < ${2:limit}; ${1:i}++)\n{\n\t${3}\n}",
      doc: "Struktur for loop",
    },
    {
      label: "while",
      insertText: "while (${1:condition})\n{\n\t${2}\n}",
      doc: "Struktur while loop",
    },
    {
      label: "OnPlayerConnect",
      insertText: "public OnPlayerConnect(playerid)\n{\n\t${1}\n\treturn 1;\n}",
      doc: "Callback saat player connect ke server",
    },
    {
      label: "OnPlayerSpawn",
      insertText: "public OnPlayerSpawn(playerid)\n{\n\t${1}\n\treturn 1;\n}",
      doc: "Callback saat player spawn",
    },
    {
      label: "OnPlayerCommandText",
      insertText: "public OnPlayerCommandText(playerid, cmdtext[])\n{\n\t${1}\n\treturn 0;\n}",
      doc: "Callback saat player ketik command chat",
    },
    {
      label: "OnPlayerDisconnect",
      insertText: "public OnPlayerDisconnect(playerid, reason)\n{\n\t${1}\n\treturn 1;\n}",
      doc: "Callback saat player disconnect dari server",
    },
    {
      label: "OnGameModeInit",
      insertText: "public OnGameModeInit()\n{\n\t${1}\n\treturn 1;\n}",
      doc: "Callback saat gamemode pertama kali load",
    },
  ];

  return snippets.map((s) => ({
    label: s.label,
    kind: K,
    insertText: s.insertText,
    insertTextRules: InsertRule,
    documentation: s.doc,
    range: range,
  }));
}

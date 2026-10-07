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
    // --- Tambahan v1.5.3: Player ---
    { name: "GetPlayerMoney", params: "(playerid)", doc: "Ambil jumlah uang player." },
    { name: "GivePlayerMoney", params: "(playerid, money)", doc: "Tambah (atau kurangi kalau negatif) uang player." },
    { name: "ResetPlayerMoney", params: "(playerid)", doc: "Reset uang player jadi 0." },
    { name: "SetPlayerSkin", params: "(playerid, skinid)", doc: "Ganti skin player." },
    { name: "GetPlayerSkin", params: "(playerid)", doc: "Ambil ID skin player." },
    { name: "GivePlayerWeapon", params: "(playerid, weaponid, ammo)", doc: "Kasih senjata ke player." },
    { name: "ResetPlayerWeapons", params: "(playerid)", doc: "Hapus semua senjata player." },
    { name: "GetPlayerWeapon", params: "(playerid)", doc: "Ambil ID senjata yang lagi dipegang player." },
    { name: "SetPlayerInterior", params: "(playerid, interiorid)", doc: "Pindahin player ke interior tertentu." },
    { name: "GetPlayerInterior", params: "(playerid)", doc: "Ambil ID interior player." },
    { name: "SetPlayerFacingAngle", params: "(playerid, Float:ang)", doc: "Atur arah hadap player." },
    { name: "GetPlayerFacingAngle", params: "(playerid, &Float:ang)", doc: "Ambil arah hadap player." },
    { name: "GetPlayerArmour", params: "(playerid, &Float:armour)", doc: "Ambil nilai armor player." },
    { name: "GetPlayerIp", params: "(playerid, name[], len)", doc: "Ambil IP player ke dalam string." },
    { name: "GetPlayerPing", params: "(playerid)", doc: "Ambil ping player." },
    { name: "SetPlayerTeam", params: "(playerid, teamid)", doc: "Atur tim player." },
    { name: "SetPlayerWantedLevel", params: "(playerid, level)", doc: "Atur wanted level (0-6)." },
    { name: "SetPlayerTime", params: "(playerid, hour, minute)", doc: "Atur jam dalam game untuk satu player." },
    { name: "SetPlayerWeather", params: "(playerid, weather)", doc: "Atur cuaca untuk satu player." },
    { name: "SetPlayerSpecialAction", params: "(playerid, actionid)", doc: "Atur special action (misal SPECIAL_ACTION_USECELLPHONE)." },
    { name: "SetPlayerFightingStyle", params: "(playerid, style)", doc: "Atur gaya bertarung player." },
    { name: "IsPlayerAdmin", params: "(playerid)", doc: "Cek apakah player login sebagai RCON admin." },
    { name: "IsPlayerInRangeOfPoint", params: "(playerid, Float:range, Float:x, Float:y, Float:z)", doc: "Cek apakah player ada dalam jarak tertentu dari titik." },
    { name: "GetPlayerDistanceFromPoint", params: "(playerid, Float:X, Float:Y, Float:Z)", doc: "Ambil jarak player dari sebuah titik." },
    { name: "SetPlayerCameraPos", params: "(playerid, Float:x, Float:y, Float:z)", doc: "Atur posisi kamera player." },
    { name: "SetPlayerCameraLookAt", params: "(playerid, Float:x, Float:y, Float:z, cut = CAMERA_CUT)", doc: "Atur arah pandang kamera player." },
    { name: "SetCameraBehindPlayer", params: "(playerid)", doc: "Kembalikan kamera ke belakang player." },
    { name: "SetSpawnInfo", params: "(playerid, team, skin, Float:x, Float:y, Float:z, Float:rotation, weapon1, weapon1_ammo, weapon2, weapon2_ammo, weapon3, weapon3_ammo)", doc: "Atur info spawn player." },
    { name: "AddPlayerClass", params: "(modelid, Float:spawn_x, Float:spawn_y, Float:spawn_z, Float:z_angle, weapon1, weapon1_ammo, weapon2, weapon2_ammo, weapon3, weapon3_ammo)", doc: "Tambah class untuk pemilihan karakter." },
    { name: "ApplyAnimation", params: "(playerid, const animlib[], const animname[], Float:fDelta, loop, lockx, locky, freeze, time, forcesync = 0)", doc: "Jalankan animasi pada player." },
    { name: "ClearAnimations", params: "(playerid, forcesync = 0)", doc: "Hentikan animasi player." },
    { name: "GameTextForPlayer", params: "(playerid, const string[], time, style)", doc: "Tampilkan teks besar di layar satu player." },
    { name: "GameTextForAll", params: "(const string[], time, style)", doc: "Tampilkan teks besar di layar semua player." },
    { name: "SetPlayerCheckpoint", params: "(playerid, Float:x, Float:y, Float:z, Float:size)", doc: "Pasang checkpoint untuk player." },
    { name: "DisablePlayerCheckpoint", params: "(playerid)", doc: "Hapus checkpoint player." },
    { name: "SetPlayerMapIcon", params: "(playerid, iconid, Float:x, Float:y, Float:z, markertype, color, style = MAPICON_LOCAL)", doc: "Pasang ikon di peta player." },
    { name: "PlayerPlaySound", params: "(playerid, soundid, Float:x, Float:y, Float:z)", doc: "Mainkan suara untuk player." },
    // --- Tambahan v1.5.3: Vehicle ---
    { name: "IsPlayerInAnyVehicle", params: "(playerid)", doc: "Cek apakah player ada di dalam kendaraan." },
    { name: "IsPlayerInVehicle", params: "(playerid, vehicleid)", doc: "Cek apakah player ada di kendaraan tertentu." },
    { name: "RemovePlayerFromVehicle", params: "(playerid)", doc: "Keluarkan player dari kendaraan." },
    { name: "GetPlayerVehicleSeat", params: "(playerid)", doc: "Ambil nomor kursi player di kendaraan." },
    { name: "GetVehiclePos", params: "(vehicleid, &Float:x, &Float:y, &Float:z)", doc: "Ambil posisi kendaraan." },
    { name: "SetVehiclePos", params: "(vehicleid, Float:x, Float:y, Float:z)", doc: "Pindahin kendaraan ke posisi tertentu." },
    { name: "GetVehicleZAngle", params: "(vehicleid, &Float:z_angle)", doc: "Ambil sudut hadap kendaraan." },
    { name: "SetVehicleZAngle", params: "(vehicleid, Float:z_angle)", doc: "Atur sudut hadap kendaraan." },
    { name: "GetVehicleHealth", params: "(vehicleid, &Float:health)", doc: "Ambil health kendaraan." },
    { name: "ChangeVehicleColor", params: "(vehicleid, color1, color2)", doc: "Ganti warna kendaraan." },
    { name: "GetVehicleModel", params: "(vehicleid)", doc: "Ambil ID model kendaraan." },
    { name: "IsValidVehicle", params: "(vehicleid)", doc: "Cek apakah ID kendaraan valid." },
    { name: "AddStaticVehicle", params: "(modelid, Float:spawn_x, Float:spawn_y, Float:spawn_z, Float:z_angle, color1, color2)", doc: "Tambah kendaraan statis (biasanya di OnGameModeInit)." },
    { name: "AddStaticVehicleEx", params: "(modelid, Float:spawn_x, Float:spawn_y, Float:spawn_z, Float:z_angle, color1, color2, respawn_delay, addsiren = 0)", doc: "Tambah kendaraan statis dengan delay respawn." },
    { name: "SetVehicleVirtualWorld", params: "(vehicleid, worldid)", doc: "Atur virtual world kendaraan." },
    // --- Tambahan v1.5.3: TextDraw ---
    { name: "TextDrawDestroy", params: "(Text:text)", doc: "Hapus textdraw global." },
    { name: "TextDrawShowForAll", params: "(Text:text)", doc: "Tampilkan textdraw ke semua player." },
    { name: "TextDrawHideForAll", params: "(Text:text)", doc: "Sembunyikan textdraw dari semua player." },
    { name: "TextDrawSetString", params: "(Text:text, const string[])", doc: "Ubah isi teks textdraw." },
    { name: "TextDrawFont", params: "(Text:text, font)", doc: "Atur font textdraw (0-5)." },
    { name: "TextDrawLetterSize", params: "(Text:text, Float:x, Float:y)", doc: "Atur ukuran huruf textdraw." },
    { name: "TextDrawColor", params: "(Text:text, color)", doc: "Atur warna teks." },
    { name: "TextDrawBoxColor", params: "(Text:text, color)", doc: "Atur warna kotak textdraw." },
    { name: "TextDrawUseBox", params: "(Text:text, use)", doc: "Aktifkan atau matikan kotak textdraw." },
    { name: "TextDrawTextSize", params: "(Text:text, Float:x, Float:y)", doc: "Atur ukuran area textdraw." },
    { name: "TextDrawAlignment", params: "(Text:text, alignment)", doc: "Atur perataan teks (1 kiri, 2 tengah, 3 kanan)." },
    { name: "TextDrawBackgroundColor", params: "(Text:text, color)", doc: "Atur warna outline atau bayangan." },
    { name: "TextDrawSetOutline", params: "(Text:text, size)", doc: "Atur ketebalan outline." },
    { name: "TextDrawSetShadow", params: "(Text:text, size)", doc: "Atur ukuran bayangan." },
    { name: "TextDrawSetProportional", params: "(Text:text, set)", doc: "Aktifkan spasi proporsional antar huruf." },
    // --- Tambahan v1.5.3: Object & Pickup ---
    { name: "DestroyObject", params: "(objectid)", doc: "Hapus object." },
    { name: "SetObjectPos", params: "(objectid, Float:X, Float:Y, Float:Z)", doc: "Pindahin object." },
    { name: "MoveObject", params: "(objectid, Float:X, Float:Y, Float:Z, Float:Speed, Float:RotX = -1000.0, Float:RotY = -1000.0, Float:RotZ = -1000.0)", doc: "Gerakkan object dengan animasi." },
    { name: "DestroyPickup", params: "(pickup)", doc: "Hapus pickup." },
    // --- Tambahan v1.5.3: Server ---
    { name: "SetGameModeText", params: "(const string[])", doc: "Atur teks gamemode di daftar server." },
    { name: "SendRconCommand", params: "(const command[])", doc: "Kirim perintah RCON dari script." },
    { name: "GetMaxPlayers", params: "()", doc: "Ambil jumlah slot maksimal server." },
    { name: "GameModeExit", params: "()", doc: "Akhiri gamemode (server restart ke gamemode berikutnya)." },
    { name: "UsePlayerPedAnims", params: "()", doc: "Pakai animasi jalan CJ untuk semua skin." },
    { name: "ShowPlayerMarkers", params: "(mode)", doc: "Atur tampilan marker player di radar." },
    { name: "EnableStuntBonusForAll", params: "(enable)", doc: "Aktifkan atau matikan bonus stunt." },
    { name: "SendPlayerMessageToAll", params: "(senderid, const message[])", doc: "Kirim chat atas nama player ke semua orang." },
    { name: "SendDeathMessage", params: "(killer, killee, weapon)", doc: "Tampilkan pesan kematian di killfeed." },
    { name: "SetWorldTime", params: "(hour)", doc: "Atur jam dalam game untuk semua player." },
    { name: "SetWeather", params: "(weatherid)", doc: "Atur cuaca untuk semua player." },
    { name: "CallLocalFunction", params: "(const function[], const format[], {Float,_}:...)", doc: "Panggil fungsi public di script ini lewat nama." },
    { name: "CallRemoteFunction", params: "(const function[], const format[], {Float,_}:...)", doc: "Panggil fungsi public di semua script yang jalan." },
    // --- Tambahan v1.5.3: String ---
    { name: "strlen", params: "(const string[])", doc: "Ambil panjang string." },
    { name: "strcmp", params: "(const string1[], const string2[], bool:ignorecase = false, length = cellmax)", doc: "Bandingkan dua string (0 kalau sama)." },
    { name: "strcat", params: "(dest[], const source[], maxlength = sizeof dest)", doc: "Sambung string ke akhir string lain." },
    { name: "strfind", params: "(const string[], const sub[], bool:ignorecase = false, pos = 0)", doc: "Cari substring (return posisi, atau -1)." },
    { name: "strmid", params: "(dest[], const source[], start, end, maxlength = sizeof dest)", doc: "Ambil potongan string." },
    { name: "strdel", params: "(string[], start, end)", doc: "Hapus bagian dari string." },
    { name: "strins", params: "(string[], const substr[], pos, maxlength = sizeof string)", doc: "Sisipkan teks ke dalam string." },
    // --- Tambahan v1.5.3: Float & Waktu ---
    { name: "floatabs", params: "(Float:value)", doc: "Nilai absolut float." },
    { name: "floatsqroot", params: "(Float:value)", doc: "Akar kuadrat." },
    { name: "floatround", params: "(Float:value, floatround_method:method = floatround_round)", doc: "Bulatkan float jadi integer." },
    { name: "floatsin", params: "(Float:value, anglemode:mode = radian)", doc: "Sinus." },
    { name: "floatcos", params: "(Float:value, anglemode:mode = radian)", doc: "Kosinus." },
    { name: "floatpower", params: "(Float:value, Float:exponent)", doc: "Pangkat." },
    { name: "GetTickCount", params: "()", doc: "Ambil waktu dalam milidetik sejak server nyala." },
    { name: "gettime", params: "(&hour = 0, &minute = 0, &second = 0)", doc: "Ambil timestamp Unix (dan jam, menit, detik)." },
    { name: "getdate", params: "(&year = 0, &month = 0, &day = 0)", doc: "Ambil tanggal hari ini." },
    // --- Tambahan v1.5.3: PVar ---
    { name: "SetPVarInt", params: "(playerid, const varname[], int_value)", doc: "Simpan variabel integer per player." },
    { name: "GetPVarInt", params: "(playerid, const varname[])", doc: "Ambil variabel integer per player." },
    { name: "SetPVarString", params: "(playerid, const varname[], const string_value[])", doc: "Simpan variabel string per player." },
    { name: "GetPVarString", params: "(playerid, const varname[], string_return[], len)", doc: "Ambil variabel string per player." },
    { name: "SetPVarFloat", params: "(playerid, const varname[], Float:float_value)", doc: "Simpan variabel float per player." },
    { name: "GetPVarFloat", params: "(playerid, const varname[])", doc: "Ambil variabel float per player." },
    { name: "DeletePVar", params: "(playerid, const varname[])", doc: "Hapus variabel per player." },
    // --- Tambahan v1.5.3: File ---
    { name: "fopen", params: "(const name[], filemode:mode = io_readwrite)", doc: "Buka file." },
    { name: "fclose", params: "(File:handle)", doc: "Tutup file." },
    { name: "fwrite", params: "(File:handle, const string[])", doc: "Tulis string ke file." },
    { name: "fread", params: "(File:handle, string[], size = sizeof string, bool:pack = false)", doc: "Baca satu baris dari file." },
    { name: "fexist", params: "(const name[])", doc: "Cek apakah file ada." },
    { name: "fremove", params: "(const name[])", doc: "Hapus file." },
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

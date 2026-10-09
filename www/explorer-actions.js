// PawnStudio - tombol "..." di Explorer: tampilkan Rename/Hapus per item
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('.btn-more');
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  var row = b.closest('.file-item, .folder-item');
  if (!row) return;
  var on = row.classList.contains('show-actions');
  document.querySelectorAll('.show-actions').forEach(function (r) { r.classList.remove('show-actions'); });
  if (!on) row.classList.add('show-actions');
});

// Custom background picture. Stored only on this device (never uploaded).
(() => {
  const $ = s => document.querySelector(s), R = document.documentElement;
  const K = 'tt_bg', F = 'tt_bgfade';
  const nb = $('#nb');
  if (!nb) return;
  nb.insertAdjacentHTML('beforebegin',
    '<div class="li" id="bgRow"><span class="ico" style="background:var(--ol)">🖼️</span><span class="t">Background<small id="bgS">Pick your own photo</small></span><button class="val" id="bgPick" style="min-height:44px">Choose</button></div>' +
    '<div class="li" id="bgCtl" style="display:none"><span class="t">Fade<small>Higher is easier to read</small></span><input type="range" id="bgFade" min="20" max="95" value="60" style="width:40%;accent-color:var(--blue)"><button class="val" id="bgRm" style="min-height:44px">Remove</button></div>' +
    '<input type="file" id="bgFile" accept="image/*" hidden>');

  function apply() {
    let d = null, f = 60;
    try { d = localStorage.getItem(K); f = +localStorage.getItem(F) || 60; } catch (e) {}
    if (d) {
      const t = `color-mix(in srgb,var(--bg) ${f}%,transparent)`;
      R.style.background = `linear-gradient(${t},${t}),url("${d}") center/cover no-repeat`;
      document.body.style.background = 'transparent';
    } else { R.style.background = ''; document.body.style.background = ''; }
    $('#bgCtl').style.display = d ? 'flex' : 'none';
    $('#bgS').textContent = d ? 'Your photo is on this device' : 'Pick your own photo';
    $('#bgPick').textContent = d ? 'Change' : 'Choose';
    if (+$('#bgFade').value !== f) $('#bgFade').value = f;
  }

  async function load(file) {
    const img = await new Promise((ok, no) => {
      const u = URL.createObjectURL(file), i = new Image();
      i.onload = () => { URL.revokeObjectURL(u); ok(i); }; i.onerror = no; i.src = u;
    });
    const s = Math.min(1, 1400 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  }

  $('#bgPick').onclick = () => $('#bgFile').click();
  $('#bgFile').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { localStorage.setItem(K, await load(f)); apply(); }
    catch (x) { window.TT && TT.toast('Could not use that picture'); }
  };
  $('#bgFade').oninput = e => { try { localStorage.setItem(F, e.target.value); } catch (x) {} apply(); };
  $('#bgRm').onclick = () => { try { localStorage.removeItem(K); } catch (x) {} apply(); };
  apply();
})();

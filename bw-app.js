/* =============================================
   BEMILWIS BOUTIQUE — Core Application JS
   Auth · Cart · Shoe Dashboard · WhatsApp Checkout
   ============================================= */

const BW_OWNER_WHATSAPP = '254111760757'; // Replace with Bemilwis owner number

/* ─── AUTH ─── */
const Auth = (() => {
  const USERS_KEY = 'bw_users';
  const SESSION_KEY = 'bw_session';

  function getUsers() { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); }
  function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }
  function getSession() { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  function saveSession(u) { localStorage.setItem(SESSION_KEY, JSON.stringify(u)); }
  function clearSession() { localStorage.removeItem(SESSION_KEY); }

  function register(name, email, password) {
    const users = getUsers();
    if (users.find(u => u.email === email)) return { ok: false, msg: 'Email already registered.' };
    const user = { id: Date.now(), name, email, password: btoa(password), joined: new Date().toISOString(), orders: [] };
    users.push(user);
    saveUsers(users);
    saveSession(user);
    return { ok: true, user };
  }

  function login(email, password) {
    const users = getUsers();
    const user = users.find(u => u.email === email && u.password === btoa(password));
    if (!user) return { ok: false, msg: 'Invalid email or password.' };
    saveSession(user);
    return { ok: true, user };
  }

  function logout() { clearSession(); updateAuthUI(); }
  function current() { return getSession(); }

  function saveOrder(order) {
    const session = getSession();
    if (!session) return;
    const users = getUsers();
    const idx = users.findIndex(u => u.id === session.id);
    if (idx === -1) return;
    users[idx].orders = users[idx].orders || [];
    users[idx].orders.unshift(order);
    saveUsers(users);
    saveSession(users[idx]);
  }

  return { register, login, logout, current, saveOrder };
})();

/* ─── CART ─── */
const Cart = (() => {
  const KEY = 'bw_cart';
  function get() { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  function save(items) { localStorage.setItem(KEY, JSON.stringify(items)); updateCartUI(); }

  function add(product) {
    const items = get();
    const cartId = `${product.id}_${product.color || ''}_${product.size || ''}`;
    const ex = items.find(i => i.cartId === cartId);
    if (ex) { ex.qty += product.qty || 1; }
    else { items.push({ ...product, cartId, qty: product.qty || 1 }); }
    save(items);
    showToast(`${product.name} added to cart! 🛍️`, 'success');
  }

  function remove(cartId) { save(get().filter(i => i.cartId !== cartId)); }

  function updateQty(cartId, qty) {
    const items = get();
    const item = items.find(i => i.cartId === cartId);
    if (item) { item.qty = Math.max(1, qty); save(items); }
  }

  function clear() { save([]); }
  function total() { return get().reduce((s, i) => s + i.price * i.qty, 0); }

  return { get, add, remove, updateQty, clear, total };
})();

/* ─── CART UI ─── */
function updateCartUI() {
  const items = Cart.get();
  const total = Cart.total();
  const count = items.reduce((s, i) => s + i.qty, 0);

  document.querySelectorAll('.cart-count').forEach(el => el.textContent = count);

  const cartItemsEl = document.getElementById('bwCartItems');
  const cartTotalEl = document.getElementById('bwCartTotal');
  if (!cartItemsEl) return;

  if (items.length === 0) {
    cartItemsEl.innerHTML = '<p class="bw-cart-empty">Your cart is empty.</p>';
  } else {
    cartItemsEl.innerHTML = items.map(item => `
      <div class="bw-cart-item">
        <img src="${item.img}" alt="${item.name}" onerror="this.src='logo.png'">
        <div class="bw-cart-details">
          <p class="bw-cart-name">${item.name}</p>
          ${item.color ? `<p class="bw-cart-meta">Color: <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${item.color};vertical-align:middle;border:1px solid #ddd;"></span></p>` : ''}
          ${item.size ? `<p class="bw-cart-meta">Size: ${item.size}</p>` : ''}
          <p class="bw-cart-price">Kes. ${(item.price * item.qty).toLocaleString()}</p>
          <div class="bw-qty-ctrl">
            <button onclick="bwChangeQty('${item.cartId}',-1)">−</button>
            <span>${item.qty}</span>
            <button onclick="bwChangeQty('${item.cartId}',1)">+</button>
          </div>
        </div>
        <button class="bw-remove" onclick="Cart.remove('${item.cartId}')">✕</button>
      </div>`).join('');
  }
  if (cartTotalEl) cartTotalEl.textContent = `Kes. ${total.toLocaleString()}`;
}

function bwChangeQty(cartId, delta) {
  const items = Cart.get();
  const item = items.find(i => i.cartId === cartId);
  if (!item) return;
  if (item.qty + delta < 1) Cart.remove(cartId);
  else Cart.updateQty(cartId, item.qty + delta);
  updateCartUI();
}

function setCartVisible(show) {
  const cart = document.getElementById('bwCart');
  if (!cart) return;
  cart.classList.toggle('open', show);
  document.body.classList.toggle('cart-open', show);
  if (show) updateCartUI();
}

/* ─── WHATSAPP CHECKOUT ─── */
function checkoutWhatsApp() {
  const items = Cart.get();
  if (!items.length) { showToast('Your cart is empty!', 'error'); return; }

  const user = Auth.current();
  let msg = '👠 *Bemilwis Boutique — New Order*\n\n';
  if (user) msg += `👤 *Customer:* ${user.name}\n📧 ${user.email}\n\n`;
  msg += '*Items Ordered:*\n';
  items.forEach(i => {
    let detail = `• ${i.name}`;
    if (i.size) detail += ` | Size: ${i.size}`;
    if (i.colorName) detail += ` | Color: ${i.colorName}`;
    detail += ` × ${i.qty} = Kes. ${(i.price * i.qty).toLocaleString()}\n`;
    msg += detail;
  });
  msg += `\n💰 *TOTAL: Kes. ${Cart.total().toLocaleString()}*\n\n📦 Please confirm my order. Thank you!`;

  const order = { id: Date.now(), date: new Date().toISOString(), items: [...items], total: Cart.total() };
  if (user) Auth.saveOrder(order);

  window.open(`https://wa.me/${BW_OWNER_WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank');
  Cart.clear();
  setCartVisible(false);
  showToast('Order sent via WhatsApp! 🎉', 'success');
}

/* ─── SHOE PRODUCT DASHBOARD ─── */
function openShoeDashboard(product) {
  const modal = document.getElementById('shoeDashboard');
  if (!modal) return;

  document.getElementById('sd-img').src = product.img;
  document.getElementById('sd-name').textContent = product.name;
  document.getElementById('sd-price').textContent = `Kes. ${product.price.toLocaleString()}`;
  document.getElementById('sd-desc').textContent = product.desc || 'Crafted for style and comfort. A Bemilwis signature piece.';
  document.getElementById('sd-qty').value = 1;

  // Colors
  const colorsEl = document.getElementById('sd-colors');
  let selectedColor = null;
  let selectedColorName = null;
  if (product.colors && product.colors.length) {
    colorsEl.parentElement.style.display = '';
    colorsEl.innerHTML = product.colors.map((c, i) => `
      <button class="color-swatch ${i === 0 ? 'selected' : ''}" 
        style="background:${c.hex};" 
        title="${c.name}"
        data-color="${c.hex}" 
        data-name="${c.name}"
        onclick="selectColor(this,'${c.hex}','${c.name}')"></button>`).join('');
    if (product.colors[0]) { selectedColor = product.colors[0].hex; selectedColorName = product.colors[0].name; }
  } else {
    colorsEl.parentElement.style.display = 'none';
  }

  // Sizes
  const sizesEl = document.getElementById('sd-sizes');
  let selectedSize = null;
  if (product.sizes && product.sizes.length) {
    sizesEl.parentElement.style.display = '';
    sizesEl.innerHTML = product.sizes.map((s, i) => `
      <button class="size-btn ${i === 0 ? 'selected' : ''}" 
        data-size="${s}"
        onclick="selectSize(this,'${s}')">${s}</button>`).join('');
    selectedSize = product.sizes[0];
  } else {
    sizesEl.parentElement.style.display = 'none';
  }

  document.getElementById('sd-add').onclick = () => {
    const currentColor = document.querySelector('.color-swatch.selected')?.dataset.color || selectedColor;
    const currentColorName = document.querySelector('.color-swatch.selected')?.dataset.name || selectedColorName;
    const currentSize = document.querySelector('.size-btn.selected')?.dataset.size || selectedSize;

    if (product.sizes && product.sizes.length && !currentSize) {
      showToast('Please select a size', 'error'); return;
    }

    Cart.add({
      id: product.id,
      name: product.name,
      price: product.price,
      img: product.img,
      color: currentColor,
      colorName: currentColorName,
      size: currentSize,
      qty: parseInt(document.getElementById('sd-qty').value) || 1
    });
    modal.classList.remove('open');
  };

  modal.classList.add('open');
}

function selectColor(btn, hex, name) {
  document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const img = document.getElementById('sd-img');
  // If product has alt image, could swap here
}

function selectSize(btn, size) {
  document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

/* ─── AUTH UI ─── */
function updateAuthUI() {
  const user = Auth.current();
  document.querySelectorAll('.auth-trigger').forEach(el => {
    el.textContent = user ? (user.name.split(' ')[0] + ' ▾') : 'Sign In';
    el.onclick = () => user ? openDashboard() : openAuthModal('login');
  });
}

function openAuthModal(tab) {
  const m = document.getElementById('bwAuthModal');
  if (!m) return;
  m.classList.add('open');
  switchAuthTab(tab || 'login');
}
function closeAuthModal() { document.getElementById('bwAuthModal')?.classList.remove('open'); }

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.tab === tab));
  document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
}

function handleRegister(e) {
  e.preventDefault();
  const f = e.target;
  const res = Auth.register(
    f.querySelector('[name=name]').value.trim(),
    f.querySelector('[name=email]').value.trim(),
    f.querySelector('[name=password]').value
  );
  if (!res.ok) { showToast(res.msg, 'error'); return; }
  closeAuthModal();
  updateAuthUI();
  showToast(`Welcome to Bemilwis, ${res.user.name}! 👠`, 'success');
}

function handleLogin(e) {
  e.preventDefault();
  const f = e.target;
  const res = Auth.login(f.querySelector('[name=email]').value.trim(), f.querySelector('[name=password]').value);
  if (!res.ok) { showToast(res.msg, 'error'); return; }
  closeAuthModal();
  updateAuthUI();
  showToast(`Welcome back, ${res.user.name}!`, 'success');
}

/* ─── DASHBOARD ─── */
function openDashboard() {
  const user = Auth.current();
  if (!user) { openAuthModal('login'); return; }
  const modal = document.getElementById('bwDashboard');
  if (!modal) return;

  document.getElementById('bw-dash-name').textContent = user.name;
  document.getElementById('bw-dash-email').textContent = user.email;
  document.getElementById('bw-dash-joined').textContent = new Date(user.joined).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });
  const ordersEl = document.getElementById('bw-dash-orders');
  if (user.orders && user.orders.length) {
    ordersEl.innerHTML = user.orders.map(o => `
      <div class="bw-dash-order">
        <div class="bw-dash-order-hdr"><span>#${String(o.id).slice(-5)}</span><span>${new Date(o.date).toLocaleDateString('en-KE')}</span><strong>Kes. ${o.total.toLocaleString()}</strong></div>
        <ul>${o.items.map(i => `<li>${i.name}${i.size ? ` (${i.size})` : ''} × ${i.qty}</li>`).join('')}</ul>
      </div>`).join('');
  } else {
    ordersEl.innerHTML = '<p class="bw-dash-empty">No orders yet. Go explore the boutique! 👠</p>';
  }
  modal.classList.add('open');
}
function closeDashboard() { document.getElementById('bwDashboard')?.classList.remove('open'); }

/* ─── TOAST ─── */
function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `bw-toast bw-toast--${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3000);
}

/* ─── NAV ─── */
function sidebarToggle() {
  document.getElementById('sidebar')?.classList.toggle('active');
  document.getElementById('sidebarOverlay')?.classList.toggle('active');
  document.body.classList.toggle('no-scroll');
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('active');
  document.getElementById('sidebarOverlay')?.classList.remove('active');
  document.body.classList.remove('no-scroll');
}

/* ─── SCROLL ─── */
window.addEventListener('scroll', () => {
  const btn = document.getElementById('scrollToTop');
  if (btn) btn.classList.toggle('visible', window.scrollY > 400);
  const h = document.querySelector('header');
  if (h) h.classList.toggle('scrolled', window.scrollY > 60);
});

/* ─── HERO SLIDER ─── */
function initSliders() {
  function runSlider(sel, interval) {
    const imgs = document.querySelectorAll(sel + ' img');
    if (!imgs.length) return;
    let i = 0;
    imgs.forEach((img, idx) => img.classList.toggle('active', idx === 0));
    setInterval(() => {
      imgs[i].classList.remove('active');
      i = (i + 1) % imgs.length;
      imgs[i].classList.add('active');
    }, interval);
  }
  runSlider('.leftSlide', 5200);
  runSlider('.rightSlide', 4800);
}

/* ─── INFINITE STRIPS ─── */
function initScrollStrip(id, speed = 0.6) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML += el.innerHTML;
  let paused = false;
  el.addEventListener('mouseenter', () => paused = true);
  el.addEventListener('mouseleave', () => paused = false);
  function tick() { if (!paused) { el.scrollLeft += speed; if (el.scrollLeft >= el.scrollWidth / 2) el.scrollLeft = 0; } requestAnimationFrame(tick); }
  tick();
}

/* ─── ADVERT SCROLL ─── */
function initAdvertScroll() {
  const c = document.querySelector('.advertContainer');
  document.getElementById('leftScroll')?.addEventListener('click', () => c?.scrollBy({ left: -360, behavior: 'smooth' }));
  document.getElementById('rightScroll')?.addEventListener('click', () => c?.scrollBy({ left: 360, behavior: 'smooth' }));
}

/* ─── INIT ─── */
document.addEventListener('DOMContentLoaded', () => {
  updateAuthUI();
  updateCartUI();
  initSliders();
  initScrollStrip('whatSold');
  initScrollStrip('whatSoldTwice');
  initAdvertScroll();

  document.getElementById('bwLoginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('bwRegisterForm')?.addEventListener('submit', handleRegister);

  // Reveal on scroll
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); obs.unobserve(e.target); } });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

  // Close modals on overlay click
  document.getElementById('shoeDashboard')?.addEventListener('click', e => { if (e.target === document.getElementById('shoeDashboard')) document.getElementById('shoeDashboard').classList.remove('open'); });
  document.getElementById('bwAuthModal')?.addEventListener('click', e => { if (e.target === document.getElementById('bwAuthModal')) closeAuthModal(); });
  document.getElementById('bwDashboard')?.addEventListener('click', e => { if (e.target === document.getElementById('bwDashboard')) closeDashboard(); });
});

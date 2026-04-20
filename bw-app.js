/* =============================================================
   BEMILWIS BOUTIQUE — Core Application JS v3
   Auth · Cart · Shoe Dashboard · WhatsApp Checkout (Login-gated)
   Member Dashboard · Recommendations · UI Utilities
   ============================================================= */

const BW_OWNER_WHATSAPP = '254111760757';

/* ─────────────────────────────────────────────────────────────
   AUTH MODULE
   Users stored in localStorage; session persisted.
   Passwords encoded with btoa (for demo — production should use
   server-side hashing). Browsing history tracked per session.
───────────────────────────────────────────────────────────── */
const Auth = (() => {
  const USERS_KEY   = 'bw_users_v3';
  const SESSION_KEY = 'bw_session_v3';
  const BROWSE_KEY  = 'bw_browse_v3';

  function getUsers()   { try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch { return []; } }
  function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }
  function getSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } }
  function saveSession(u){ localStorage.setItem(SESSION_KEY, JSON.stringify(u)); }
  function clearSession(){ localStorage.removeItem(SESSION_KEY); }

  // Browsing history (product ids)
  function getBrowse()   { try { return JSON.parse(localStorage.getItem(BROWSE_KEY) || '[]'); } catch { return []; } }
  function recordBrowse(productId) {
    const h = getBrowse().filter(id => id !== productId);
    h.unshift(productId);
    localStorage.setItem(BROWSE_KEY, JSON.stringify(h.slice(0, 20)));
  }

  function validate(name, email, password) {
    if (!name || name.trim().length < 2)          return 'Please enter your full name (at least 2 characters).';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address.';
    if (!password || password.length < 8)         return 'Password must be at least 8 characters.';
    return null;
  }

  function register(name, email, password) {
    const err = validate(name, email, password);
    if (err) return { ok: false, msg: err };
    const users = getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase()))
      return { ok: false, msg: 'This email is already registered. Please sign in.' };
    const user = {
      id: Date.now(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: btoa(unescape(encodeURIComponent(password))),
      joined: new Date().toISOString(),
      orders: []
    };
    users.push(user);
    saveUsers(users);
    saveSession(user);
    return { ok: true, user };
  }

  function login(email, password) {
    if (!email || !password) return { ok: false, msg: 'Please fill in all fields.' };
    const users = getUsers();
    const user  = users.find(u =>
      u.email.toLowerCase() === email.toLowerCase().trim() &&
      u.password === btoa(unescape(encodeURIComponent(password)))
    );
    if (!user) return { ok: false, msg: 'Incorrect email or password. Please try again.' };
    saveSession(user);
    return { ok: true, user };
  }

  function logout()  { clearSession(); updateAuthUI(); }
  function current() { return getSession(); }

  function saveOrder(order) {
    const session = getSession();
    if (!session) return;
    const users = getUsers();
    const idx   = users.findIndex(u => u.id === session.id);
    if (idx === -1) return;
    users[idx].orders = [order, ...(users[idx].orders || [])];
    saveUsers(users);
    saveSession(users[idx]);
  }

  return { register, login, logout, current, saveOrder, recordBrowse, getBrowse };
})();

/* ─────────────────────────────────────────────────────────────
   CART MODULE
───────────────────────────────────────────────────────────── */
const Cart = (() => {
  const KEY = 'bw_cart_v3';

  function get()  { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
  function save(items) { localStorage.setItem(KEY, JSON.stringify(items)); updateCartUI(); }

  function add(product) {
    const items  = get();
    const cartId = `${product.id}_${product.color || ''}_${product.size || ''}`;
    const ex     = items.find(i => i.cartId === cartId);
    if (ex) { ex.qty += (product.qty || 1); }
    else     { items.push({ ...product, cartId, qty: product.qty || 1 }); }
    save(items);
    showToast(`${product.name} added to bag! 🛍️`, 'success');
    // Track browse
    if (product.id) Auth.recordBrowse(product.id);
  }

  function remove(cartId) { save(get().filter(i => i.cartId !== cartId)); }

  function updateQty(cartId, qty) {
    const items = get();
    const item  = items.find(i => i.cartId === cartId);
    if (item) { item.qty = Math.max(1, qty); save(items); }
  }

  function clear() { save([]); }
  function total() { return get().reduce((s, i) => s + i.price * i.qty, 0); }

  return { get, add, remove, updateQty, clear, total };
})();

/* ─────────────────────────────────────────────────────────────
   CART UI
───────────────────────────────────────────────────────────── */
function updateCartUI() {
  const items = Cart.get();
  const count = items.reduce((s, i) => s + i.qty, 0);

  document.querySelectorAll('.cart-count').forEach(el => el.textContent = count);

  const cartItemsEl = document.getElementById('bwCartItems');
  const cartTotalEl = document.getElementById('bwCartTotal');
  if (!cartItemsEl) return;

  if (!items.length) {
    cartItemsEl.innerHTML = '<p class="bw-cart-empty">Your bag is empty.<br><a href="shop.html" style="color:var(--rose);font-weight:600">Start shopping →</a></p>';
  } else {
    cartItemsEl.innerHTML = items.map(item => `
      <div class="bw-cart-item">
        <img src="${item.img}" alt="${item.name}" onerror="this.src='logo.png'" loading="lazy">
        <div class="bw-cart-details">
          <p class="bw-cart-name">${item.name}</p>
          ${item.colorName ? `<p class="bw-cart-meta">Color: ${item.colorName}</p>` : ''}
          ${item.size      ? `<p class="bw-cart-meta">Size: ${item.size}</p>` : ''}
          <p class="bw-cart-price">Kes. ${(item.price * item.qty).toLocaleString()}</p>
          <div class="bw-qty-ctrl">
            <button onclick="bwChangeQty('${item.cartId}',-1)" aria-label="Decrease">−</button>
            <span>${item.qty}</span>
            <button onclick="bwChangeQty('${item.cartId}',1)" aria-label="Increase">+</button>
          </div>
        </div>
        <button class="bw-remove" onclick="Cart.remove('${item.cartId}')" aria-label="Remove item">✕</button>
      </div>`).join('');
  }

  if (cartTotalEl) cartTotalEl.textContent = `Kes. ${Cart.total().toLocaleString()}`;

  // Lock WhatsApp button if not logged in
  const waBtn = document.getElementById('waBtn');
  if (waBtn) {
    const loggedIn = !!Auth.current();
    waBtn.classList.toggle('locked', !loggedIn);
    waBtn.title = loggedIn ? 'Order via WhatsApp' : 'Sign in to place your order';
  }
}

function bwChangeQty(cartId, delta) {
  const items = Cart.get();
  const item  = items.find(i => i.cartId === cartId);
  if (!item) return;
  if (item.qty + delta < 1) Cart.remove(cartId);
  else Cart.updateQty(cartId, item.qty + delta);
}

function setCartVisible(show) {
  const cart = document.getElementById('bwCart');
  if (!cart) return;
  cart.classList.toggle('open', show);
  document.body.classList.toggle('modal-open', show);
  if (show) updateCartUI();
}

/* ─────────────────────────────────────────────────────────────
   CHECKOUT — LOGIN GATE
   User MUST be logged in to proceed to WhatsApp
───────────────────────────────────────────────────────────── */
function initiateCheckout() {
  const items = Cart.get();
  if (!items.length) { showToast('Your bag is empty!', 'error'); return; }

  const user = Auth.current();
  if (!user) {
    // Close cart, open auth modal with a message
    setCartVisible(false);
    showToast('Please sign in to complete your order 🔐', 'error');
    setTimeout(() => openAuthModal('login'), 400);
    return;
  }

  // Build WhatsApp message
  let msg = `👠 *Bemilwis Boutique — New Order*\n\n`;
  msg    += `👤 *Customer:* ${user.name}\n`;
  msg    += `📧 ${user.email}\n\n`;
  msg    += `*Items Ordered:*\n`;
  items.forEach(i => {
    msg += `• ${i.name}`;
    if (i.size)      msg += ` | Size: ${i.size}`;
    if (i.colorName) msg += ` | Color: ${i.colorName}`;
    msg += ` × ${i.qty} = Kes. ${(i.price * i.qty).toLocaleString()}\n`;
  });
  msg += `\n💰 *TOTAL: Kes. ${Cart.total().toLocaleString()}*`;
  msg += `\n\n📦 Please confirm my order. Thank you!`;

  const order = {
    id:    Date.now(),
    date:  new Date().toISOString(),
    items: [...items],
    total: Cart.total()
  };
  Auth.saveOrder(order);

  window.open(`https://wa.me/${BW_OWNER_WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank');
  Cart.clear();
  setCartVisible(false);
  showToast('Order sent via WhatsApp! 🎉', 'success');
}

/* ─────────────────────────────────────────────────────────────
   SHOE PRODUCT DASHBOARD
───────────────────────────────────────────────────────────── */
function openShoeDashboard(product) {
  // Accept both object and JSON string
  if (typeof product === 'string') {
    try { product = JSON.parse(product); } catch { return; }
  }
  const modal = document.getElementById('shoeDashboard');
  if (!modal) return;

  // Track browse
  if (product.id) Auth.recordBrowse(product.id);

  document.getElementById('sd-img').src    = product.img || '';
  document.getElementById('sd-img').alt    = product.name || '';
  document.getElementById('sd-name').textContent  = product.name  || '';
  document.getElementById('sd-price').textContent = product.price ? `Kes. ${product.price.toLocaleString()}` : '';
  document.getElementById('sd-desc').textContent  = product.desc  || 'Crafted for style and comfort. A Bemilwis signature piece.';
  document.getElementById('sd-qty').value         = 1;

  // Colors
  const colorsSection = document.getElementById('sd-colors-section');
  const colorsEl      = document.getElementById('sd-colors');
  if (product.colors && product.colors.length) {
    colorsSection.style.display = '';
    colorsEl.innerHTML = product.colors.map((c, i) => `
      <button class="color-swatch ${i === 0 ? 'selected' : ''}"
        style="background:${c.hex}"
        title="${c.name}"
        data-color="${c.hex}"
        data-name="${c.name}"
        onclick="selectColor(this)"
        aria-label="${c.name}"></button>`).join('');
  } else {
    colorsSection.style.display = 'none';
  }

  // Sizes
  const sizesSection = document.getElementById('sd-sizes-section');
  const sizesEl      = document.getElementById('sd-sizes');
  if (product.sizes && product.sizes.length) {
    sizesSection.style.display = '';
    sizesEl.innerHTML = product.sizes.map((s, i) => `
      <button class="size-btn ${i === 0 ? 'selected' : ''}"
        data-size="${s}"
        onclick="selectSize(this)">${s}</button>`).join('');
  } else {
    sizesSection.style.display = 'none';
  }

  document.getElementById('sd-add').onclick = () => {
    const selColor = document.querySelector('.color-swatch.selected');
    const selSize  = document.querySelector('.size-btn.selected');
    if (product.sizes && product.sizes.length && !selSize) {
      showToast('Please select a size', 'error'); return;
    }
    Cart.add({
      id:        product.id,
      name:      product.name,
      price:     product.price,
      img:       product.img,
      color:     selColor?.dataset.color  || null,
      colorName: selColor?.dataset.name   || null,
      size:      selSize?.dataset.size    || null,
      qty:       parseInt(document.getElementById('sd-qty').value) || 1
    });
    modal.classList.remove('open');
    document.body.classList.remove('modal-open');
  };

  modal.classList.add('open');
  document.body.classList.add('modal-open');
}

function selectColor(btn) {
  document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}
function selectSize(btn) {
  document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

/* ─────────────────────────────────────────────────────────────
   AUTH UI
───────────────────────────────────────────────────────────── */
function updateAuthUI() {
  const user = Auth.current();
  document.querySelectorAll('.auth-trigger').forEach(el => {
    el.textContent = user ? `${user.name.split(' ')[0]} ▾` : 'Sign In';
    el.onclick     = () => user ? openDashboard() : openAuthModal('login');
  });
  updateCartUI(); // re-check WA button lock
}

function openAuthModal(tab) {
  const m = document.getElementById('bwAuthModal');
  if (!m) return;
  m.classList.add('open');
  document.body.classList.add('modal-open');
  switchAuthTab(tab || 'login');
  // Clear any previous errors
  document.querySelectorAll('.auth-error').forEach(e => e.classList.remove('show'));
}
function closeAuthModal() {
  document.getElementById('bwAuthModal')?.classList.remove('open');
  document.body.classList.remove('modal-open');
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.tab === tab));
  document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
}

function handleLogin(e) {
  e.preventDefault();
  const f   = e.target;
  const err = document.getElementById('loginError');
  err?.classList.remove('show');
  const res = Auth.login(
    f.querySelector('[name=email]').value,
    f.querySelector('[name=password]').value
  );
  if (!res.ok) {
    if (err) { err.textContent = res.msg; err.classList.add('show'); }
    return;
  }
  closeAuthModal();
  updateAuthUI();
  showToast(`Welcome back, ${res.user.name.split(' ')[0]}! 👠`, 'success');
}

function handleRegister(e) {
  e.preventDefault();
  const f   = e.target;
  const nameInput  = f.querySelector('[name=name]');
  const emailInput = f.querySelector('[name=email]');
  const pwInput    = f.querySelector('[name=password]');

  const name  = nameInput?.value.trim();
  const email = emailInput?.value.trim();
  const pw    = pwInput?.value;

  const errId = f.id === 'bwModalRegForm' ? 'modalRegError' : 'regError';
  const err   = document.getElementById(errId);
  err?.classList.remove('show');

  const res = Auth.register(name, email, pw);
  if (!res.ok) {
    if (err) { err.textContent = res.msg; err.classList.add('show'); }
    return;
  }
  closeAuthModal();
  f.reset();
  updateAuthUI();
  showToast(`Welcome to Bemilwis, ${res.user.name.split(' ')[0]}! 🎉`, 'success');
}

/* ─────────────────────────────────────────────────────────────
   MEMBER DASHBOARD
   Includes order history table and product recommendations
   based on browsing history.
───────────────────────────────────────────────────────────── */
function openDashboard() {
  const user = Auth.current();
  if (!user) { openAuthModal('login'); return; }

  const modal = document.getElementById('bwDashboard');
  if (!modal) return;

  // Fill header
  document.getElementById('bw-dash-name').textContent  = user.name;
  document.getElementById('bw-dash-email').textContent = user.email;

  const joined = new Date(user.joined).toLocaleDateString('en-KE', { year:'numeric', month:'long', day:'numeric' });
  document.getElementById('bw-dash-joined').textContent = joined;

  const orders  = user.orders || [];
  const spent   = orders.reduce((s, o) => s + (o.total || 0), 0);
  document.getElementById('bw-dash-order-count').textContent = orders.length;
  document.getElementById('bw-dash-spent').textContent       = `Kes. ${spent.toLocaleString()}`;

  // Order history
  const ordersEl = document.getElementById('bw-dash-orders');
  if (orders.length) {
    ordersEl.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:.78rem;" role="table" aria-label="Order history">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 0;color:var(--ink-light);font-weight:600;border-bottom:1px solid var(--border)">Order</th>
            <th style="text-align:left;padding:6px 0;color:var(--ink-light);font-weight:600;border-bottom:1px solid var(--border)">Date</th>
            <th style="text-align:right;padding:6px 0;color:var(--ink-light);font-weight:600;border-bottom:1px solid var(--border)">Total</th>
          </tr>
        </thead>
        <tbody>
          ${orders.slice(0, 5).map(o => `
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid var(--border);color:var(--rose);font-weight:700">#${String(o.id).slice(-5)}</td>
              <td style="padding:8px 0;border-bottom:1px solid var(--border);color:var(--ink-light)">${new Date(o.date).toLocaleDateString('en-KE')}</td>
              <td style="padding:8px 0;border-bottom:1px solid var(--border);text-align:right;font-weight:700">Kes. ${(o.total||0).toLocaleString()}</td>
            </tr>
            <tr><td colspan="3" style="padding:0 0 10px;font-size:.72rem;color:var(--ink-light)">${(o.items||[]).map(i=>`${i.name} ×${i.qty}`).join(', ')}</td></tr>
          `).join('')}
        </tbody>
      </table>
      ${orders.length > 5 ? `<p style="font-size:.75rem;color:var(--ink-light);margin-top:8px">Showing last 5 of ${orders.length} orders.</p>` : ''}`;
  } else {
    ordersEl.innerHTML = '<p class="bw-dash-empty">No orders yet. Go explore the boutique! 👠</p>';
  }

  // Recommendations based on browse history
  buildRecommendations();

  modal.classList.add('open');
  document.body.classList.add('modal-open');
}

function buildRecommendations() {
  const recsEl = document.getElementById('bw-dash-recs');
  if (!recsEl) return;

  // Collect a pool of products from the page's inventory if available
  let pool = [];
  if (typeof inventory !== 'undefined') {
    pool = Object.values(inventory).flat();
  } else {
    // Fallback pool for homepage
    pool = [
      {id:'h3',name:'Stiletto Pumps',price:3500,img:'https://images.unsplash.com/photo-1581101767113-1677fe077673?w=300&q=80'},
      {id:'b1',name:'Chelsea Boots',price:3500,img:'https://images.unsplash.com/photo-1520639889313-7272fd25c18f?w=300&q=80'},
      {id:'s7',name:'Platform Slides',price:2500,img:'https://images.unsplash.com/photo-1603487742131-4160ec999306?w=300&q=80'},
      {id:'g1',name:'Leather Tote',price:3500,img:'https://images.unsplash.com/photo-1584917033904-491a84e2febe?w=300&q=80'},
      {id:'h7',name:'Wedge Sandals',price:2600,img:'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=300&q=80'},
    ];
  }

  const browsed = Auth.getBrowse();
  // Pick products NOT already browsed first, then fill with popular
  let recs = pool.filter(p => !browsed.includes(p.id));
  if (recs.length < 4) recs = [...recs, ...pool.filter(p => browsed.includes(p.id))];
  recs = recs.slice(0, 5);

  if (!recs.length) {
    recsEl.innerHTML = '<p class="bw-dash-empty">Browse some products and we\'ll recommend items for you!</p>';
    return;
  }

  recsEl.innerHTML = recs.map(p => `
    <div class="bw-dash-rec-card" onclick="closeDashboard();openShoeDashboard(${JSON.stringify(p).replace(/"/g,'&quot;')})">
      <img src="${p.img}" alt="${p.name}" onerror="this.src='logo.png'" loading="lazy">
      <p>${p.name}</p>
      <span>Kes. ${p.price.toLocaleString()}</span>
    </div>`).join('');
}

function closeDashboard() {
  document.getElementById('bwDashboard')?.classList.remove('open');
  document.body.classList.remove('modal-open');
}

/* ─────────────────────────────────────────────────────────────
   TOAST
───────────────────────────────────────────────────────────── */
function showToast(msg, type = 'info') {
  // Remove existing toasts
  document.querySelectorAll('.bw-toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = `bw-toast bw-toast--${type}`;
  t.textContent = msg;
  t.setAttribute('role', 'status');
  t.setAttribute('aria-live', 'polite');
  document.body.appendChild(t);
  requestAnimationFrame(() => { requestAnimationFrame(() => t.classList.add('show')); });
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3200);
}

/* ─────────────────────────────────────────────────────────────
   NAVIGATION
───────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────
   SCROLL LISTENERS
───────────────────────────────────────────────────────────── */
window.addEventListener('scroll', () => {
  const btn = document.getElementById('scrollToTop');
  if (btn) btn.classList.toggle('visible', window.scrollY > 500);
  const h = document.getElementById('bwHeader');
  if (h) h.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

/* ─────────────────────────────────────────────────────────────
   ADVERT SCROLL
───────────────────────────────────────────────────────────── */
function initAdvertScroll() {
  const c = document.getElementById('advertContainer');
  document.getElementById('leftScroll')?.addEventListener('click',  () => c?.scrollBy({ left: -320, behavior: 'smooth' }));
  document.getElementById('rightScroll')?.addEventListener('click', () => c?.scrollBy({ left:  320, behavior: 'smooth' }));
}

/* ─────────────────────────────────────────────────────────────
   SCROLL-REVEAL OBSERVER
───────────────────────────────────────────────────────────── */
function initReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.07 });
  document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => obs.observe(el));
}

/* ─────────────────────────────────────────────────────────────
   CLOSE MODALS ON BACKDROP CLICK
───────────────────────────────────────────────────────────── */
function initModalBackdrops() {
  const modals = [
    { id: 'shoeDashboard', fn: () => { document.getElementById('shoeDashboard')?.classList.remove('open'); document.body.classList.remove('modal-open'); } },
    { id: 'bwAuthModal',   fn: closeAuthModal },
    { id: 'bwDashboard',   fn: closeDashboard },
    { id: 'bwCart',        fn: () => setCartVisible(false) },
  ];
  modals.forEach(({ id, fn }) => {
    document.getElementById(id)?.addEventListener('click', e => {
      if (e.target === document.getElementById(id)) fn();
    });
  });
  // Close modals on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeAuthModal();
      closeDashboard();
      setCartVisible(false);
      document.getElementById('shoeDashboard')?.classList.remove('open');
      document.body.classList.remove('modal-open');
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   INIT
───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  updateAuthUI();
  updateCartUI();
  initReveal();
  initAdvertScroll();
  initModalBackdrops();

  // Auth form listeners
  document.getElementById('bwLoginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('bwModalRegForm')?.addEventListener('submit', handleRegister);
  // Also homepage large reg form
  // (handled inline in index.html to share same Auth module)

  // Mark active nav link
  const path = window.location.pathname;
  document.querySelectorAll('.bw-nav a, .bw-sidebar-nav a').forEach(a => {
    a.classList.toggle('active', a.href.includes(path.split('/').pop() || 'index'));
  });
});

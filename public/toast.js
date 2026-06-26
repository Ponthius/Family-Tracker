// Toast notification system — replaces all alert() calls
(function () {
  function init() {
    var container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:360px;width:100%;pointer-events:none;font-family:Arial,sans-serif;';
      document.body.appendChild(container);
    }

    var colors = {
      success: { bg: '#e7efe2', text: '#3c5a3c', border: '#b9cdb0' },
      error: { bg: '#fbe9e9', text: '#a13d3d', border: '#eac0c0' },
      warning: { bg: '#fff3e0', text: '#8a6d3b', border: '#f0d8a0' },
      info: { bg: '#e3f0fa', text: '#2c6b9b', border: '#b0d4f0' }
    };

    window.showToast = function (message, type) {
      type = type || 'info';
      var c = colors[type] || colors.info;
      var toast = document.createElement('div');
      toast.style.cssText = 'pointer-events:auto;padding:12px 16px;border-radius:8px;border:1px solid ' + c.border + ';background:' + c.bg + ';color:' + c.text + ';font-size:0.88rem;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.1);display:flex;align-items:center;gap:10px;animation:toastIn 0.25s ease;';
      toast.textContent = message;
      var close = document.createElement('span');
      close.textContent = 'x';
      close.style.cssText = 'margin-left:auto;cursor:pointer;font-weight:700;font-size:1rem;opacity:0.6;padding:0 4px;';
      close.onclick = function () { toast.remove(); };
      toast.appendChild(close);
      container.appendChild(toast);
      setTimeout(function () {
        if (toast.parentNode) {
          toast.style.opacity = '0';
          toast.style.transition = 'opacity 0.3s';
          setTimeout(function () { if (toast.parentNode) toast.remove(); }, 300);
        }
      }, 4000);
    };

    var style = document.createElement('style');
    style.textContent = '@keyframes toastIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}';
    document.head.appendChild(style);
  }

  if (document.body) {
    init();
  } else {
    window.addEventListener('DOMContentLoaded', init);
  }
})();

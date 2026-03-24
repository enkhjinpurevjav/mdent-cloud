export function printImage(imageUrl: string) {
  const win = window.open('', '_blank', 'width=1000,height=1000');
  if (!win) return;
  const escapedUrl = imageUrl.replace(/"/g, '&quot;');
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>XRAY хэвлэх</title>
        <style>
          html, body { height: 100%; margin: 0; padding: 0; background: #fff;}
          body, .container { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; }
          img { display: none; max-width: 100vw; max-height: 100vh; width: 100vw; height: 100vh; object-fit: contain; background: #fff; margin: 0; }
          #loading { font-family: sans-serif;}
          @media print {
            html, body { width: 100vw; height: 100vh; margin: 0; padding: 0;}
            .container { width: 100vw; height: 100vh; }
            img { display: block !important; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div id="loading">Зураг ачаалж байна...</div>
          <img id="xrayImg" src="${escapedUrl}" alt="XRAY" />
        </div>
        <script>
          var img = document.getElementById('xrayImg');
          var loading = document.getElementById('loading');
          function setOrientation(orientation) {
            var style = document.createElement('style');
            style.innerHTML = '@media print { @page { size: A4 ' + orientation + '; margin: 0; } }';
            document.head.appendChild(style);
          }
          img.onload = function() {
            loading.style.display = 'none';
            img.style.display = 'block';
            var orientation = img.naturalWidth > img.naturalHeight ? 'landscape' : 'portrait';
            setOrientation(orientation);
            setTimeout(function() { window.print(); window.close(); }, 250);
          };
          img.onerror = function() {
            loading.innerText = 'Зураг ачаалагдсангүй!';
          };
        </script>
      </body>
    </html>
  `);
  win.document.close();
}

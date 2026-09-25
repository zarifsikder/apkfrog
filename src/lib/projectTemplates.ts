interface TplFile {
  path: string
  content: string
  language: string
}

export function defaultFilesFor(type: string, name: string): TplFile[] {
  const pkg = 'com.example.' + name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'myapp'
  if (type === 'kotlin') {
    return [
      {
        path: 'MainActivity.kt',
        language: 'kotlin',
        content: `package ${pkg} // আপনার প্যাকেজ নাম অনুযায়ী পরিবর্তন করুন

// Cloud compiler android.framework ব্যবহার করে — androidx/compose import করবেন না
import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        var count = 0

        val title = TextView(this).apply {
            text = "Hello from ${pkg.replace('.', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}!"
            textSize = 22f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.WHITE)
        }

        val counter = TextView(this).apply {
            text = "Count: 0"
            textSize = 17f
            setTextColor(Color.parseColor("#93c5fd"))
        }

        val button = Button(this).apply {
            text = "Tap me"
            setOnClickListener {
                count++
                counter.text = "Count: " + count
            }
        }

        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#0f172a"))
            addView(title)
            addView(counter, LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { setMargins(0, 24, 0, 24) })
            addView(button)
        }

        setContentView(box)
    }
}
`,
      },
      {
        path: 'AndroidManifest.xml',
        language: 'xml',
        content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${pkg}">

    <application
        android:label="@string/app_name"
        android:icon="@mipmap/ic_launcher"
        android:theme="@style/Theme.ApkForge.Main">
        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`,
      },
      {
        path: 'res/values/strings.xml',
        language: 'xml',
        content: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${name}</string>
</resources>
`,
      },
    ]
  }
  if (type === 'webview') {
    return [
      {
        path: 'config.json',
        language: 'json',
        content: `{
  "app_name": "${name}",
  "start_url": "https://example.com",
  "user_agent": "ApkForgeApp/1.0",
  "enable_js": true,
  "dom_storage": true
}
`,
      },
      {
        path: 'MainActivity.kt',
        language: 'kotlin',
        content: `package ${pkg}

// Cloud compiler android.framework ব্যবহার করে — androidx import করবেন না
import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

class MainActivity : Activity() {
    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            cacheMode = WebSettings.LOAD_DEFAULT
        }
        webView.webViewClient = WebViewClient()
        webView.loadUrl("https://example.com") // আপনার ওয়েবসাইট URL দিন
        setContentView(webView)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
`,
      },
      {
        path: 'AndroidManifest.xml',
        language: 'xml',
        content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${pkg}">
    <uses-permission android:name="android.permission.INTERNET" />
    <application
        android:label="@string/app_name"
        android:icon="@mipmap/ic_launcher"
        android:theme="@style/Theme.ApkForge.Main"
        android:usesCleartextTraffic="true">
        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`,
      },
      { path: 'res/values/strings.xml', language: 'xml', content: `<resources>\n    <string name="app_name">${name}</string>\n</resources>\n` },
    ]
  }
  if (type === 'html') {
    return [
      {
        path: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="app">
    <h1>🚀 ${name}</h1>
    <p>Built with ApkForge — HTML / CSS / JS</p>
    <button id="tapBtn">Tap me</button>
    <p id="counter">Taps: 0</p>
  </div>
  <script src="script.js"></script>
</body>
</html>
`,
      },
      {
        path: 'style.css',
        language: 'css',
        content: `* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: system-ui, sans-serif;
  background: linear-gradient(135deg, #1d4ed8, #38bdf8);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.app { text-align: center; padding: 24px; }
h1 { font-size: 28px; margin-bottom: 8px; }
p { opacity: .9; margin-bottom: 20px; }
button {
  padding: 14px 36px;
  font-size: 16px;
  border: none;
  border-radius: 14px;
  background: #fff;
  color: #1d4ed8;
  font-weight: 700;
  cursor: pointer;
}
`,
      },
      {
        path: 'script.js',
        language: 'javascript',
        content: `let taps = 0;
const btn = document.getElementById('tapBtn');
const counter = document.getElementById('counter');
btn.addEventListener('click', () => {
  taps++;
  counter.textContent = 'Taps: ' + taps;
});
`,
      },
    ]
  }
  // blank
  return [
    {
      path: 'index.html',
      language: 'html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
</head>
<body>
  <h1>${name}</h1>
  <p>Start coding here...</p>
</body>
</html>
`,
    },
  ]
}

export function seedTemplates() {
  return [
    {
      title: 'Calculator Pro',
      author: 'ApkForge Team',
      authorInitials: 'AF',
      price: 0,
      category: 'Tools',
      views: 1284,
      downloads: 356,
      featured: true,
      previewType: 'gradient',
      previewText: '🧮',
      previewSub: 'Calculator',
    },
    {
      title: 'WebView Store',
      author: 'Din Alamin',
      authorInitials: 'DA',
      price: 100,
      category: 'Business',
      views: 812,
      downloads: 143,
      featured: true,
      previewType: 'code',
      previewText: 'Hello Store!',
      previewSub: 'Start coding here...',
    },
    {
      title: 'Flowers',
      author: 'Din Alamin',
      authorInitials: 'DA',
      price: 0,
      category: 'Lifestyle',
      views: 71,
      downloads: 12,
      featured: false,
      previewType: 'dark',
      previewText: '✦ ✧ ✦',
      previewSub: null,
    },
    {
      title: 'never',
      author: 'Din Alamin',
      authorInitials: 'DA',
      price: 100,
      category: 'Templates',
      views: 120,
      downloads: 20,
      featured: false,
      previewType: 'code',
      previewText: 'Hello never!',
      previewSub: 'Start coding here...',
    },
    {
      title: 'Portfolio Kit',
      author: 'Sadia Islam',
      authorInitials: 'SI',
      price: 0,
      category: 'Personal',
      views: 530,
      downloads: 98,
      featured: false,
      previewType: 'gradient',
      previewText: '👤',
      previewSub: 'Portfolio',
    },
    {
      title: 'Quiz Master',
      author: 'Tanvir Hasan',
      authorInitials: 'TH',
      price: 150,
      category: 'Education',
      views: 344,
      downloads: 45,
      featured: false,
      previewType: 'dark',
      previewText: '❓ Quiz',
      previewSub: null,
    },
    {
      title: 'News Reader',
      author: 'ApkForge Team',
      authorInitials: 'AF',
      price: 0,
      category: 'News',
      views: 221,
      downloads: 31,
      featured: false,
      previewType: 'gradient',
      previewText: '📰',
      previewSub: 'Daily News',
    },
    {
      title: 'Tournament App',
      author: 'ProGamer',
      authorInitials: 'PG',
      price: 250,
      category: 'Gaming',
      views: 990,
      downloads: 210,
      featured: true,
      previewType: 'dark',
      previewText: '🏆',
      previewSub: null,
    },
  ]
}

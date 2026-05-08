# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  MarkFlowy — Windows PowerShell 自动检测 + 一键启动脚本
#  无需预装 Node.js，脚本会自动检测并安装
#  用法: powershell -ExecutionPolicy Bypass -File start.ps1
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

$ErrorActionPreference = "Stop"
$Port = 3000
$MinNodeMajor = 18
$Version = "0.2.0"
$DistDir = Join-Path $PSScriptRoot "dist"

# ---------- 检查 dist 目录 ----------
if (-not (Test-Path (Join-Path $DistDir "index.html"))) {
    Write-Host "[ERROR] 找不到构建产物 dist\index.html" -ForegroundColor Red
    Write-Host ""
    Write-Host "请先构建项目："
    Write-Host "  npm install"
    Write-Host "  npm run build"
    Read-Host "按回车退出"
    exit 1
}

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║     MarkFlowy 环境检测与启动          ║" -ForegroundColor Cyan
Write-Host "  ╚═══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ---------- 检测 Node.js ----------
function Test-NodeJS {
    $nodePath = Get-Command node -ErrorAction SilentlyContinue
    if ($nodePath) {
        $ver = (node -v) -replace '^v', ''
        $major = $ver.Split('.')[0] -as [int]
        if ($major -ge $MinNodeMajor) {
            Write-Host "[OK]    Node.js v$ver 已安装 (需要 >= $MinNodeMajor)" -ForegroundColor Green
            return $true
        } else {
            Write-Host "[WARN]  Node.js v$ver 版本过低 (需要 >= $MinNodeMajor)" -ForegroundColor Yellow
            return $false
        }
    }
    return $false
}

# ---------- 安装 Node.js ----------
function Install-NodeJS {
    Write-Host ""
    Write-Host "[INFO]  正在安装 Node.js..." -ForegroundColor Cyan
    Write-Host "────────────────────────────────────────" -ForegroundColor DarkGray

    # 方案1: fnm
    $fnmPath = Get-Command fnm -ErrorAction SilentlyContinue
    if (-not $fnmPath) {
        Write-Host "[INFO]  安装 fnm..." -ForegroundColor Cyan
        try {
            Install-Script -Name fnm -Scope CurrentUser -Force -ErrorAction Stop 2>$null
            $fnmInstalled = $true
        } catch {
            $fnmInstalled = $false
        }

        if ($fnmInstalled -and (Get-Command fnm -ErrorAction SilentlyContinue)) {
            fnm install --lts
            fnm use lts-latest
            if (Test-NodeJS) { return $true }
        }
    } else {
        fnm install --lts
        fnm use lts-latest
        if (Test-NodeJS) { return $true }
    }

    # 方案2: winget
    $wingetPath = Get-Command winget -ErrorAction SilentlyContinue
    if ($wingetPath) {
        Write-Host "[INFO]  使用 winget 安装 Node.js..." -ForegroundColor Cyan
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        $env:PATH = "$env:PATH;$env:ProgramFiles\nodejs"
        if (Test-NodeJS) { return $true }
    }

    # 方案3: 直接下载
    Write-Host "[INFO]  直接下载 Node.js..." -ForegroundColor Cyan
    $arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
    $nodeVer = "22.14.0"
    $url = "https://nodejs.org/dist/v${nodeVer}/node-v${nodeVer}-win-${arch}.zip"
    $tmpZip = Join-Path $env:TEMP "node-install.zip"
    $destDir = Join-Path $env:USERPROFILE ".local\node"

    try {
        Write-Host "[INFO]  下载 Node.js v${nodeVer}..." -ForegroundColor Cyan
        Invoke-WebRequest -Uri $url -OutFile $tmpZip -UseBasicParsing
        Expand-Archive -Path $tmpZip -DestinationPath $destDir -Force
        Remove-Item $tmpZip -ErrorAction SilentlyContinue

        $nodeBin = Join-Path $destDir "node-v${nodeVer}-win-${arch}"
        $env:PATH = "$env:PATH;$nodeBin"

        # 持久化 PATH
        $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
        if ($currentPath -notlike "*$nodeBin*") {
            [Environment]::SetEnvironmentVariable("PATH", "$currentPath;$nodeBin", "User")
        }

        if (Test-NodeJS) { return $true }
    } catch {
        Write-Host "[ERROR] 下载失败: $_" -ForegroundColor Red
    }

    Write-Host "[ERROR] 所有安装方式均失败" -ForegroundColor Red
    Write-Host "  下载地址: https://nodejs.org/" -ForegroundColor Yellow
    return $false
}

# ---------- 使用 .NET 内置 HTTP 服务器（最后备选） ----------
function Start-DotNetServer {
    Add-Type -TypeDefinition @"
using System;
using System.Net;
using System.IO;
using System.Threading;

public class SimpleServer {
    public static void Start(string dir, int port) {
        var listener = new HttpListener();
        listener.Prefixes.Add($"http://localhost:{port}/");
        listener.Start();
        Console.WriteLine($"[INFO]  使用 .NET HTTP 服务器 (端口 {port})...");

        while (true) {
            var ctx = listener.GetContext();
            var path = ctx.Request.Url.AbsolutePath;
            if (path == "/") path = "/index.html";
            var filePath = Path.Combine(dir, path.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));

            if (File.Exists(filePath)) {
                var ext = Path.GetExtension(filePath).ToLower();
                ctx.Response.ContentType = ext switch {
                    ".html" => "text/html; charset=utf-8",
                    ".js"   => "application/javascript; charset=utf-8",
                    ".css"  => "text/css; charset=utf-8",
                    ".json" => "application/json; charset=utf-8",
                    ".svg"  => "image/svg+xml",
                    ".png"  => "image/png",
                    ".ico"  => "image/x-icon",
                    ".woff" => "font/woff",
                    ".woff2"=> "font/woff2",
                    _       => "application/octet-stream"
                };
                var bytes = File.ReadAllBytes(filePath);
                ctx.Response.ContentLength64 = bytes.Length;
                ctx.Response.OutputStream.Write(bytes, 0, bytes.Length);
                ctx.Response.OutputStream.Close();
            } else {
                ctx.Response.StatusCode = 404;
                ctx.Response.Close();
            }
        }
    }
}
"@ -Language CSharp

    [SimpleServer]::Start($DistDir, $Port)
}

# ---------- 启动服务器 ----------
function Start-MarkFlowy {
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor White
    Write-Host "  MarkFlowy v$Version" -ForegroundColor White
    Write-Host "  轻量级 Markdown 编辑器" -ForegroundColor White
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor White
    Write-Host ""

    $url = "http://localhost:${Port}"

    # 打开浏览器
    Start-Sleep -Seconds 1
    Start-Process $url

    # 优先级: npx serve > python > .NET 内置
    $npxCmd = Get-Command npx -ErrorAction SilentlyContinue
    if ($npxCmd) {
        Write-Host "[INFO]  使用 serve 启动 HTTP 服务器 (端口 $Port)..." -ForegroundColor Cyan
        & npx -y serve $DistDir -l $Port -s
        return
    }

    $pyCmd = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pyCmd) { $pyCmd = Get-Command python3 -ErrorAction SilentlyContinue }
    if ($pyCmd) {
        Write-Host "[INFO]  使用 Python 启动 HTTP 服务器 (端口 $Port)..." -ForegroundColor Cyan
        Push-Location $DistDir
        & $pyCmd.Source -m http.server $Port
        Pop-Location
        return
    }

    # 最后备选: .NET 内置
    Write-Host "[INFO]  使用 .NET 内置 HTTP 服务器 (端口 $Port)..." -ForegroundColor Cyan
    Write-Host "[WARN]  此服务器为简易版本，建议安装 Node.js 或 Python 获得更好体验" -ForegroundColor Yellow
    Start-DotNetServer
}

# ---------- 主流程 ----------
if (Test-NodeJS) {
    # Node.js 已就绪
} else {
    Write-Host "[WARN]  未检测到 Node.js (需要 >= $MinNodeMajor)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "是否自动安装 Node.js？" -ForegroundColor White
    Write-Host "  [1] 是，自动安装 (推荐)"
    Write-Host "  [2] 跳过，使用备选服务器"
    Write-Host "  [3] 退出"
    Write-Host ""
    $choice = Read-Host "请选择 [1/2/3]"

    switch ($choice) {
        "1" { Install-NodeJS | Out-Null }
        "2" { Write-Host "[WARN]  跳过 Node.js 安装" -ForegroundColor Yellow }
        default { Write-Host "[INFO]  已退出"; exit 0 }
    }
}

Start-MarkFlowy

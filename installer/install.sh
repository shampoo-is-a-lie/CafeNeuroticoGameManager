#!/bin/bash
# =============================================================================
# Cafe Neurotico Ecosystem — Menu Installer
# Self-contained: SVG icons are embedded below. No zip or extra files needed.
# Usage: bash install.sh
# =============================================================================

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPS_DIR="$HOME/.local/share/applications"
ICONS_DIR="$DIR/icons"

# ── Embedded SVG icons (base64) ───────────────────────────────────────────────

CNGM_SVG_B64="PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMiA1MTIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPCEtLSBCYXNlIEJhY2tncm91bmQgLS0+CiAgPHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMTIiIGZpbGw9IiMyQzFFMTYiLz4KICAKICA8IS0tIE91dGVyIENvbm5lY3RvcnMgLS0+CiAgPHBhdGggZD0iTSAyNCAyNTYgSCAxMTYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0Q0QTM3MyIgc3Ryb2tlLXdpZHRoPSIxMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPGNpcmNsZSBjeD0iNzAiIGN5PSIyNTYiIHI9IjgiIGZpbGw9IiNENEEzNzMiLz4KICA8cGF0aCBkPSJNIDM5NiAyNTYgSCA0ODgiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0Q0QTM3MyIgc3Ryb2tlLXdpZHRoPSIxMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPGNpcmNsZSBjeD0iNDQyIiBjeT0iMjU2IiByPSI4IiBmaWxsPSIjRDRBMzczIi8+CgogIDwhLS0gVGhlIFBpbGwgQmVhbiBCb2R5IC0tPgogIDxyZWN0IHg9IjExNiIgeT0iODAiIHdpZHRoPSIyODAiIGhlaWdodD0iMzUyIiByeD0iMTQwIiBmaWxsPSIjNDMyODE4IiBzdHJva2U9IiNENEEzNzMiIHN0cm9rZS13aWR0aD0iMjAiLz4KCiAgPCEtLSBUaGUgUy1DcmFjayBFcmFzZXIgKFNwbGl0cyB0aGUgYmVhbiB1c2luZyBiYWNrZ3JvdW5kIGNvbG9yKSAtLT4KICA8cGF0aCBkPSJNIDI1NiAyNCBWIDEzNiBMIDIxNiAxNzYgViAyMTYgTCAyOTYgMjk2IFYgMzM2IEwgMjU2IDM3NiBWIDQ4OCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMkMxRTE2IiBzdHJva2Utd2lkdGg9IjI4IiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CgogIDwhLS0gVGhlIEdsb3dpbmcgUy1DcmFjayBDaXJjdWl0IFRyYWNlIC0tPgogIDxwYXRoIGQ9Ik0gMjU2IDI0IFYgMTM2IEwgMjE2IDE3NiBWIDIxNiBMIDI5NiAyOTYgViAzMzYgTCAyNTYgMzc2IFYgNDg4IiBmaWxsPSJub25lIiBzdHJva2U9IiNGRkU2QTciIHN0cm9rZS13aWR0aD0iOCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgoKICA8IS0tIENpcmN1aXQgTm9kZXMgYWxvbmcgdGhlIHRyYWNlIC0tPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjEzNiIgcj0iOCIgZmlsbD0iI0ZGRTZBNyIvPgogIDxjaXJjbGUgY3g9IjIxNiIgY3k9IjE3NiIgcj0iOCIgZmlsbD0iI0ZGRTZBNyIvPgogIDxjaXJjbGUgY3g9IjIxNiIgY3k9IjIxNiIgcj0iOCIgZmlsbD0iI0ZGRTZBNyIvPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjI1NiIgcj0iMTIiIGZpbGw9IiNGRkU2QTciLz4gPCEtLSBDb3JlIENlbnRlciBOb2RlIC0tPgogIDxjaXJjbGUgY3g9IjI5NiIgY3k9IjI5NiIgcj0iOCIgZmlsbD0iI0ZGRTZBNyIvPgogIDxjaXJjbGUgY3g9IjI5NiIgY3k9IjMzNiIgcj0iOCIgZmlsbD0iI0ZGRTZBNyIvPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjM3NiIgcj0iOCIgZmlsbD0iI0ZGRTZBNyIvPgoKICA8IS0tIEdvbGRlbiBPdXRlciBCb3JkZXIgKERyYXduIGxhc3QgdG8gb3ZlcmxheSBwZXJmZWN0bHkpIC0tPgogIDxyZWN0IHg9IjI0IiB5PSIyNCIgd2lkdGg9IjQ2NCIgaGVpZ2h0PSI0NjQiIHJ4PSI4OCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOEI1QTJCIiBzdHJva2Utd2lkdGg9IjEyIi8+Cjwvc3ZnPgo="

CREMA_SVG_B64="PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMiA1MTIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPCEtLSBCYXNlIEJhY2tncm91bmQgLS0+CiAgPHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMTIiIGZpbGw9IiMyQzFFMTYiLz4KICAKICA8IS0tIEdvbGRlbiBJbm5lciBCb3JkZXIgLS0+CiAgPHJlY3QgeD0iMjQiIHk9IjI0IiB3aWR0aD0iNDY0IiBoZWlnaHQ9IjQ2NCIgcng9Ijg4IiBmaWxsPSJub25lIiBzdHJva2U9IiM4QjVBMkIiIHN0cm9rZS13aWR0aD0iMTIiLz4KCiAgPCEtLSBDb2ZmZWUgQ3VwIEhhbmRsZSAtLT4KICA8cGF0aCBkPSJNIDM4MCAyNTYgQyA0OTAgMjU2LCA0OTAgMTUwLCAzODAgMTUwIiBmaWxsPSJub25lIiBzdHJva2U9IiNENEEzNzMiIHN0cm9rZS13aWR0aD0iMjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgoKICA8IS0tIEVzcHJlc3NvIEN1cCBCYXNlIC0tPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjI1NiIgcj0iMTYwIiBmaWxsPSIjNDMyODE4IiBzdHJva2U9IiNENEEzNzMiIHN0cm9rZS13aWR0aD0iMTYiLz4KCiAgPCEtLSBDcmVtYSAvIFZpbnlsIFN3aXJscyAtLT4KICA8cGF0aCBkPSJNIDI1NiAxMzYgQSAxMjAgMTIwIDAgMCAxIDM3NiAyNTYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0Q0QTM3MyIgc3Ryb2tlLXdpZHRoPSIxNiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPHBhdGggZD0iTSAyNTYgMzc2IEEgMTIwIDEyMCAwIDAgMSAxMzYgMjU2IiBmaWxsPSJub25lIiBzdHJva2U9IiNENEEzNzMiIHN0cm9rZS13aWR0aD0iMTYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDxwYXRoIGQ9Ik0gMTg2IDI1NiBBIDcwIDcwIDAgMCAxIDI1NiAxODYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0ZGRTZBNyIgc3Ryb2tlLXdpZHRoPSIxMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPHBhdGggZD0iTSAzMjYgMjU2IEEgNzAgNzAgMCAwIDEgMjU2IDMyNiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRkZFNkE3IiBzdHJva2Utd2lkdGg9IjEyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KCiAgPCEtLSBHYW1lcGFkIEFCWFkgQnV0dG9ucyAtLT4KICA8IS0tIFRvcCBCdXR0b24gKFkvVHJpYW5nbGUpIC0tPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjIwNCIgcj0iMTgiIGZpbGw9IiNGRkU2QTciLz4KICA8IS0tIEJvdHRvbSBCdXR0b24gKEEvQ3Jvc3MpIC0tPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjMwOCIgcj0iMTgiIGZpbGw9IiNGRkU2QTciLz4KICA8IS0tIExlZnQgQnV0dG9uIChYL1NxdWFyZSkgLS0+CiAgPGNpcmNsZSBjeD0iMjA0IiBjeT0iMjU2IiByPSIxOCIgZmlsbD0iI0ZGRTZBNyIvPgogIDwhLS0gUmlnaHQgQnV0dG9uIChCL0NpcmNsZSkgLS0+CiAgPGNpcmNsZSBjeD0iMzA4IiBjeT0iMjU2IiByPSIxOCIgZmlsbD0iI0ZGRTZBNyIvPgo8L3N2Zz4K"

# ── Helpers ───────────────────────────────────────────────────────────────────

ok()   { echo "   ✔  $*"; }
warn() { echo "   ⚠  $*"; }
info() { echo "   ℹ  $*"; }

# ── Step 1: Extract icons ─────────────────────────────────────────────────────

echo ""
echo "☕ Cafe Neurotico Ecosystem — Menu Installer"
echo "────────────────────────────────────────────"
echo ""
echo "→ Extracting icons..."

mkdir -p "$ICONS_DIR"

if command -v base64 &>/dev/null; then
    echo "$CNGM_SVG_B64" | base64 -d > "$ICONS_DIR/CNGM.svg"
    echo "$CREMA_SVG_B64" | base64 -d > "$ICONS_DIR/CREMA.svg"
    ok "Icons written to $ICONS_DIR"
else
    warn "base64 command not found — icons could not be extracted."
fi

# ── Step 2: Find AppImages ────────────────────────────────────────────────────

echo ""
echo "→ Looking for AppImages in: $DIR"

CNGM_APPIMAGE=$(find "$DIR" -maxdepth 1 -iname "CNGM*.AppImage" | head -1)
CREMA_APPIMAGE=$(find "$DIR" -maxdepth 1 -iname "CREMA*.AppImage" | head -1)

if [ -n "$CNGM_APPIMAGE" ]; then
    chmod +x "$CNGM_APPIMAGE"
    ok "Found CNGM: $(basename "$CNGM_APPIMAGE")"
else
    warn "No CNGM*.AppImage found in this folder."
fi

if [ -n "$CREMA_APPIMAGE" ]; then
    chmod +x "$CREMA_APPIMAGE"
    ok "Found CREMA: $(basename "$CREMA_APPIMAGE")"
else
    warn "No CREMA*.AppImage found in this folder."
fi

# ── Step 3: Create .desktop entries ──────────────────────────────────────────

echo ""
echo "→ Creating application menu entries..."

mkdir -p "$APPS_DIR"

if [ -n "$CNGM_APPIMAGE" ]; then
    cat > "$APPS_DIR/cafe-neurotico-game-manager.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Cafe Neurotico Game Manager
Comment=The neurotic manager for your gaming library.
Exec="$CNGM_APPIMAGE"
Icon=$ICONS_DIR/CNGM.svg
Terminal=false
Categories=Game;Utility;
EOF
    ok "Menu entry created for Cafe Neurotico Game Manager."
fi

if [ -n "$CREMA_APPIMAGE" ]; then
    cat > "$APPS_DIR/cafe-neurotico-crema.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=CREMA
Comment=The Bon Vivant Fullscreen Gamepad-Centered Interface.
Exec="$CREMA_APPIMAGE"
Icon=$ICONS_DIR/CREMA.svg
Terminal=false
Categories=Game;
EOF
    ok "Menu entry created for CREMA."
fi

# ── Step 4: Refresh launcher database ────────────────────────────────────────

if command -v update-desktop-database &>/dev/null; then
    update-desktop-database "$APPS_DIR" 2>/dev/null
fi

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo "✅ Done! Both apps should now appear in your application launcher."
echo ""
info "If you ever move this folder, run install.sh again to update the paths."
echo ""

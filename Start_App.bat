@echo off
title Sonora Zen - Tinnitus & Somatic Relief Suite
echo =====================================================================
echo           SONORA ZEN - TINNITUS & SOMATIC RELIEF SUITE
echo =====================================================================
echo.
echo Starting local neuro-acoustic audio server...
echo Opening in your default web browser...
echo.

cd /d "%~dp0"
start "" http://localhost:8182/index.html
python -m http.server 8182
pause

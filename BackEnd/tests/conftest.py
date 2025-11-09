"""Pytest configuration ensuring the FastAPI backend 'app' package is importable.

Adds BackEnd directory to sys.path so tests can do 'from app...'.
"""
import os
import sys

BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

"""Publish the static build to a free Hugging Face static Space.
Usage:  HF_TOKEN=... python app/deploy_static.py [owner/space-name]
Build first:  cd app/frontend && npm run build:static
"""
import os, sys, tempfile, shutil
from pathlib import Path
from huggingface_hub import HfApi

repo = sys.argv[1] if len(sys.argv) > 1 else 'nayanasisil2700/heads-up'
dist = Path(__file__).parent / 'frontend' / 'dist-static'
assert (dist / 'index.html').exists(), 'run npm run build:static first'
readme = """---
title: Heads Up
emoji: 📦
colorFrom: blue
colorTo: indigo
sdk: static
pinned: false
short_description: Late delivery risk and shipment prioritization
---

# Heads Up

Decision support for the DataCo operations team. Orders are ranked by chance of being late times order value, with the reasons behind each score. The tuned XGBoost model runs in your browser, so nothing is sent to a server.

Demo data: the 11,836 test orders (Aug 2017 to Jan 2018) from the DataCo Smart Supply Chain dataset. IT3091 Machine Learning, Group 5.
"""
with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / 'space'; shutil.copytree(dist, out); (out / 'README.md').write_text(readme)
    api = HfApi(token=os.environ['HF_TOKEN'])
    api.create_repo(repo, repo_type='space', space_sdk='static', exist_ok=True)
    api.upload_folder(folder_path=str(out), repo_id=repo, repo_type='space', commit_message='Deploy Heads Up static build', delete_patterns='*')
print('https://huggingface.co/spaces/' + repo)

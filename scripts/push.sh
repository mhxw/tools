rm -rf .git
git init
git add .
git commit -m 'first commit'
git branch -M dev
git remote add origin https://github.com/mhxw/tools.git
git push -u -f origin dev

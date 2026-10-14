@echo off
rem Detached launcher for isolated QA dev server bound to the LOCAL test DB.
set "DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/app_db_test"
set "ADMIN_SESSION_SECRET=qa-local-test-secret-1234567890"
set "TEAM_SESSION_SECRET=qa-local-test-secret-1234567890"
set "NODE_ENV=development"
cd /d "c:\Users\nitheesh\Desktop\full-stack-technical-quiz-platform"
node node_modules/next/dist/bin/next dev -p 3400

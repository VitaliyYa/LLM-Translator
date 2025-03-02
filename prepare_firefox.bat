@echo off
echo Создание директории для Firefox расширения...
mkdir firefox_build 2>nul

echo Копирование файлов в директорию для Firefox...
xcopy /y background.js firefox_build\
xcopy /y content.js firefox_build\
xcopy /y options.html firefox_build\
xcopy /y options.js firefox_build\
xcopy /y /i icons firefox_build\icons

echo Копирование Firefox манифеста...
copy manifest.firefox.json firefox_build\manifest.json

echo Готово! Firefox-версия расширения находится в директории firefox_build\
echo Вы можете загрузить это расширение в Firefox через about:debugging
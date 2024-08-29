@Echo Off
SETLOCAL EnableDelayedExpansion

:menu
echo Please select options: 
echo.
echo [1.]  Install Node Modules
echo [2.]  Start Bot
echo [3.]  Fix Reinstall Node modules
echo [4.]  Exit
echo.----------------------------

set /p choice=Selected: 

if /i "%choice%"=="1" (
    echo Installing Node Modules...
    npm install
    echo Node Modules Installed! Press a key to continue...
    pause>nul
    goto menu
)

if /i "%choice%"=="2" (
	node main.js
    echo Bot has stopped. Press a key to continue...
    pause>nul
    goto menu
)

if /i "%choice%"=="3" (
    echo Deleting node modules folder...
    rmdir /s /q node_modules
    echo Node Modules deleted!
    echo Reinstalling Node Modules...
    npm install
    echo All modules have been installed! Press a key to continue...
    pause>nul
    goto menu
)

if /i "%choice%"=="4" (
    echo Exit...
    exit /b
)

:: Reset the color to default before displaying the "Wrong choice" message
color
echo.
echo Wrong choice! Press a key to continue...
pause>nul
goto menu

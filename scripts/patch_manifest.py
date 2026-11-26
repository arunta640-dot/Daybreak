"""Add the permissions Daybreak needs for reliable reminders to AndroidManifest.xml."""
import re, sys
p = "android/app/src/main/AndroidManifest.xml"
s = open(p, encoding="utf-8").read()
perms = ["android.permission.POST_NOTIFICATIONS", "android.permission.SCHEDULE_EXACT_ALARM",
         "android.permission.RECEIVE_BOOT_COMPLETED", "android.permission.VIBRATE", "android.permission.WAKE_LOCK"]
add = "".join(f'    <uses-permission android:name="{x}" />\n' for x in perms if x not in s)
if add:
    s = s.replace("</manifest>", add + "</manifest>")
# lock to portrait
if "screenOrientation" not in s:
    s = s.replace("<activity", '<activity android:screenOrientation="portrait"', 1)
open(p, "w", encoding="utf-8").write(s)
print("manifest patched")

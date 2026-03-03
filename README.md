# שובר לבנים — פרימיום

משחק Arkanoid/Breakout מודרני שנבנה ב־**React + TypeScript + Canvas**.

## פיצ'רים

- UI בעברית (RTL) + עיצוב פרימיום
- 3 שלבים (עם סקלביליות לעוד)
- חיזוקים (Power-ups):
  - רחב (WIDE)
  - רב־כדור (MULTI)
  - אש (FIRE)
  - האטה (SLOW)
  - לייזר (LASER)
  - מגן תחתון (SHIELD)
- שליטה:
  - מקלדת: ←→ / A-D, רווח/Enter, P (pause), M (mute), R (reset)
  - מובייל: גרירה להזזה + לחיצה לפעולה
- סאונד סינתטי (WebAudio) עם toggle
- נגישות בסיסית: aria labels, תמיכה ב־prefers-reduced-motion, ניגודיות גבוהה

## פיתוח מקומי

```bash
npm i
npm run dev
```

## בדיקות / איכות

```bash
npm run lint
npm run test -- --run
npm run format
```

## דיפלוי (GitHub Pages)

הפרויקט מגיע עם Workflow שמבצע build ופריסה ל־GitHub Pages.

---

נבנה ללא נכסים ממותגים/מוגנים (אין sprites/copyrighted audio). הכל מקורי בקנבס + סינתזה.

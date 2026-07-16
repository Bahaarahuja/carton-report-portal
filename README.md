# Carton Report Portal — Frontend Only

Open `index.html` directly, or run:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

The app supports CSV, XLSX, and XLS files for:
- Cartons Consumed
- Cartons Created
- Challan Movement
- Carton Movements

It creates a full-column report matching the grouped table style of the sample PDF. A single report date is shown above the table. A warning is shown only when more than one date is found.

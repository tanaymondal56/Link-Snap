# Link Snap - Analytics & Data Strategy

## 1. Data Collection Strategy (The "What")

To provide "Resume Flex" level analytics, we need to capture more than just a click count. Every time a user hits a short link, we will extract and store the following data points before redirecting.

### Data Points to Capture

1.  **Timestamp**: Exact date and time of the click (ISO 8601).
2.  **IP Address**: Used to determine geolocation.
    - _Privacy Note:_ We will convert this to a location (Country/City) immediately and store the location, not the raw IP, or hash the IP for unique visitor counting.
3.  **User Agent String**: Used to parse:
    - **Device Type**: Mobile, Tablet, Desktop.
    - **Operating System**: Windows, macOS, iOS, Android, Linux.
    - **Browser**: Chrome, Safari, Firefox, Edge.
4.  **Referrer**: The URL the user came from (e.g., t.co, facebook.com, direct).

---

## 2. Database Schema Design

To ensure the `Url` model doesn't hit the 16MB MongoDB document limit with massive arrays, we will use a separate **Analytics Model** (or a highly optimized sub-document structure).

### Option A: Separate Collection (Recommended for Scalability)

**Model: `Analytics`**

```javascript
{
  urlId: { type: mongoose.Schema.Types.ObjectId, ref: 'Url' },
  timestamp: { type: Date, default: Date.now },
  device: { type: String }, // e.g., "Mobile"
  os: { type: String },     // e.g., "iOS"
  browser: { type: String },// e.g., "Safari"
  location: {
    country: String,
    city: String
  },
  referrer: { type: String }
}
```

### Option B: Embedded Array (Simpler, good for MVP)

**Model: `Url`**

```javascript
{
  // ... other fields
  visitHistory: [
    {
      timestamp: Number,
      device: String,
      location: String,
    },
  ];
}
```

_Decision: We will proceed with **Option A** (Separate Collection) to demonstrate "handling Database writes" and scalability as per the "Resume Flex" goal._

---

## 3. The Analytics Page UI (The "Flex")

This page needs to look professional and data-rich.

### Layout Structure

**A. Header Section**

- **Title**: The Short URL (e.g., `link-snap.com/abc12`).
- **Subtitle**: The Original Destination (truncated).
- **Actions**: "Copy Link", "Download QR Code".

**B. Key Performance Indicators (KPI Cards)**

- **Total Clicks**: Big bold number.
- **Unique Visitors**: Calculated based on unique IPs/Cookies.
- **Top Location**: Flag + Country Name (e.g., 🇺🇸 United States).
- **Top Device**: Icon + Name (e.g., 📱 Mobile).

**C. Main Visualization (The "Hook")**

- **Component**: `Recharts` AreaChart or LineChart.
- **X-Axis**: Time (Last 24h, Last 7 Days, All Time).
- **Y-Axis**: Clicks.
- **Tooltip**: Shows exact count on hover.

**D. Secondary Insights (Grid Layout)**

- **Device Breakdown**: Donut Chart (Mobile vs Desktop vs Tablet).
- **OS Distribution**: Horizontal Bar Chart (Windows, Android, iOS).
- **Top Locations**: List or Map Chart showing top 5 countries.
- **Referrer Sources**: List showing where traffic is coming from (e.g., "Twitter: 45%", "Direct: 30%").

---

## 4. Implementation Libraries

- **Backend**:
  - `useragent`: To parse the User-Agent string.
  - `geoip-lite`: To look up location from IP address.
- **Frontend**:
  - `recharts`: For all graphs.
  - `lucide-react`: For icons (Globe, Smartphone, Monitor).
  - `date-fns`: For formatting timestamps on the frontend.

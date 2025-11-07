# Install Performance Optimization Packages

Run these commands to install required packages for performance optimizations:

```bash
cd FCT-DCIP-BACKEND
npm install compression
```

## What This Adds

- **compression**: Gzip compression middleware for Express
  - Reduces response sizes by 50-70%
  - Faster data transfer
  - Lower bandwidth usage

## After Installation

1. Restart your backend server
2. Check console for "Request timing" logs
3. Monitor for slow request warnings (>1s)
4. Verify compression is working (check response headers for `Content-Encoding: gzip`)

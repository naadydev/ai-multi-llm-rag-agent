// #region Overview
// Domain / protocol constants that are not user-tunable and therefore
// don't belong in .env. Centralized here so any change (e.g. accepting
// a new file type) touches one location.
// #endregion

// #region PDF ingestion
// The MIME type we accept on the ingest endpoint. Hard-coded because the
// entire pipeline (loader, magic-byte check) is PDF-specific — supporting
// another type would be a code change, not a config change.
export const PDF_MIME_TYPE = 'application/pdf';

// Every valid PDF begins with these five bytes. Used as a sniff test to
// reject files whose Content-Type header lies about their contents.
export const PDF_MAGIC_BYTES = Buffer.from('%PDF-');
// #endregion


export function NoticeBanner({ notice }) {
  return notice ? <div className="floating-notice">{notice}</div> : null;
}

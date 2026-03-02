export const AnimatedIconCoreLogo = ({ className = '' }: { className?: string }) => {
  return (
    <svg className={className} viewBox="0 0 168 168" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="wg0" x1="149.289" y1="30.3809" x2="52.757" y2="86.1136" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d9d9d9" />
          <stop offset="1" stopColor="#777777" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="wg1" x1="71.9139" y1="0.000585915" x2="71.9139" y2="111.466" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d9d9d9" />
          <stop offset="1" stopColor="#777777" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="wg2" x1="19.1568" y1="136.514" x2="115.689" y2="80.7817" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d9d9d9" />
          <stop offset="1" stopColor="#777777" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="wg3" x1="160.879" y1="116.036" x2="65.1761" y2="58.8911" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d9d9d9" />
          <stop offset="1" stopColor="#777777" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="wg4" x1="97.1139" y1="167.465" x2="97.1139" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d9d9d9" />
          <stop offset="1" stopColor="#777777" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="wg5" x1="5.15698" y1="52.7812" x2="101.689" y2="108.514" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d9d9d9" />
          <stop offset="1" stopColor="#777777" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="wStripeGradient" x1="62" y1="36" x2="110" y2="128" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff">
            <animate attributeName="stop-color" dur="6.8s" repeatCount="indefinite" values="#ffffff;#4dd2ff;#ff7ae6;#ffd84d;#ffffff" />
          </stop>
          <stop offset="50%" stopColor="#ffffff">
            <animate attributeName="stop-color" dur="6.8s" repeatCount="indefinite" values="#ffffff;#8ef2ff;#ffb0f2;#fff6a3;#ffffff" />
          </stop>
          <stop offset="100%" stopColor="#f5f5f5">
            <animate attributeName="stop-color" dur="6.8s" repeatCount="indefinite" values="#f5f5f5;#9ec8ff;#ff95d3;#ffe17a;#f5f5f5" />
          </stop>
        </linearGradient>
        <filter id="wStripeGlow" x="-45%" y="-45%" width="190%" height="190%">
          <feGaussianBlur stdDeviation="6.8" result="blur" />
        </filter>
      </defs>

      <path d="M143.215 30.2294C143.648 30.5306 143.916 30.9995 143.986 31.5223L149.406 71.9308C149.526 72.8197 148.505 73.4314 147.781 72.9017C141.548 68.3394 121.398 54.4554 102.154 50.6388C81.7675 46.5955 30.9815 57.3154 34.952 54.6242C38.9226 51.933 80.4908 20.6101 104.229 19.5306C125.145 18.5794 139.983 27.9803 143.215 30.2294Z" fill="url(#wg0)" />
      <path d="M71.602 5.84382C72.0516 5.67727 72.5327 5.70313 72.9745 5.88952L107.994 20.6656C108.816 21.0125 108.829 22.1944 108.012 22.5544C100.975 25.6561 78.8348 36.1725 65.8905 50.9495C52.1957 66.5831 36.0863 115.925 35.7409 111.141C35.3955 106.357 29.0532 54.696 39.9876 33.5981C49.7584 14.7455 67.8598 7.22996 71.602 5.84382Z" fill="url(#wg1)" />
      <path d="M25.2302 136.666C24.7973 136.365 24.5297 135.896 24.4595 135.373L19.0394 94.9644C18.9202 94.0756 19.9409 93.4639 20.6646 93.9936C26.8981 98.5558 47.0478 112.44 66.2916 116.256C86.6782 120.3 137.464 109.58 133.494 112.271C129.523 114.962 87.9549 146.285 64.2163 147.365C43.3004 148.316 28.463 138.915 25.2302 136.666Z" fill="url(#wg2)" />
      <path d="M155.246 115.597C155.148 116.096 154.85 116.515 154.426 116.796L124.576 136.599C123.852 137.08 122.882 136.477 122.99 135.614C123.922 128.154 126.313 103.556 120.223 84.7444C113.821 64.9713 79.7153 25.8439 84 28.0001C88.2847 30.1563 135.891 51.1956 148.4 71.4C159.615 89.5153 156.094 111.288 155.246 115.597Z" fill="url(#wg3)" />
      <path d="M97.4258 161.622C96.9762 161.789 96.4951 161.763 96.0533 161.577L61.0343 146.8C60.212 146.454 60.1988 145.272 61.0155 144.912C68.0526 141.81 90.193 131.294 103.137 116.517C116.832 100.883 132.941 51.541 133.287 56.3252C133.632 61.1094 139.975 112.77 129.04 133.868C119.269 152.721 101.168 160.236 97.4258 161.622Z" fill="url(#wg4)" />
      <path d="M10.7961 53.2166C10.887 52.7178 11.1773 52.2958 11.5952 52.0086L41.1512 31.6932C41.8686 31.2001 42.8492 31.7877 42.754 32.6531C41.931 40.1325 39.9034 64.7559 46.2683 83.4718C52.96 103.149 87.6367 141.771 83.3208 139.678C79.0049 137.585 31.0943 117.247 18.2902 97.2287C6.80967 79.2796 10.0114 57.523 10.7961 53.2166Z" fill="url(#wg5)" />
      <path d="M61.6 66.3999C61.6 49.8314 75.0315 36.3999 91.6 36.3999H106.424C108.081 36.3999 109.424 37.743 109.424 39.3999V98.3691C109.424 114.938 95.9925 128.369 79.424 128.369H64.6C62.9432 128.369 61.6 127.026 61.6 125.369V66.3999Z" fill="url(#wStripeGradient)" />
      <path d="M61.6 66.3999C61.6 49.8314 75.0315 36.3999 91.6 36.3999H106.424C108.081 36.3999 109.424 37.743 109.424 39.3999V98.3691C109.424 114.938 95.9925 128.369 79.424 128.369H64.6C62.9432 128.369 61.6 127.026 61.6 125.369V66.3999Z" fill="url(#wStripeGradient)" opacity="0.72" filter="url(#wStripeGlow)" />
    </svg>
  );
};

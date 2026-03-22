import { useState } from 'react'

function Login() {
  const [phone, setPhone] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-sm">

        <h1 className="text-3xl font-bold text-green-600 text-center mb-1">
          KhataGST
        </h1>
        <p className="text-center text-gray-500 text-sm mb-8">
          Har dukaan ka CA
        </p>

        {/* Phone Input — OTP bhejne se pehle */}
        {!otpSent && (
          <>
            <label className="text-sm font-medium text-gray-700">
              Mobile Number
            </label>
            <div className="flex mt-1 mb-4">
              <span className="px-3 py-2 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg text-gray-600">
                +91
              </span>
              <input
                type="tel"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              onClick={() => setOtpSent(true)}
              className="w-full bg-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-green-700 transition"
            >
              OTP Bhejo
            </button>
          </>
        )}

        {/* OTP Input — OTP bhejne ke baad */}
        {otpSent && (
          <>
            <p className="text-sm text-gray-600 mb-4 text-center">
              +91 {phone} pe OTP bheja gaya
            </p>
            <label className="text-sm font-medium text-gray-700">
              OTP Daalo
            </label>
            <input
              type="text"
              placeholder="6 digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full mt-1 mb-4 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button className="w-full bg-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-green-700 transition">
              Verify Karo
            </button>
            <button
              onClick={() => setOtpSent(false)}
              className="w-full mt-2 text-sm text-gray-500 hover:text-green-600"
            >
              ← Number change karo
            </button>
          </>
        )}

        <p className="text-center text-xs text-gray-400 mt-4">
          Login karke aap hamare Terms se agree karte hain
        </p>
      </div>
    </div>
  )
}

export default Login
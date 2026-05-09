'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User, GraduationCap, Mail, Lock, Upload, FileText, X, Image as ImageIcon } from 'lucide-react'

export default function LoginPage() {
    const [isSignUp, setIsSignUp] = useState(false)
    const [formData, setFormData] = useState({
        fullName: '',
        studentNumber: '',
        email: '',
        password: '',
        loginIdentifier: ''
    })
    const [verificationFile, setVerificationFile] = useState(null)
    const [filePreview, setFilePreview] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const fileInputRef = useRef(null)

    const router = useRouter()

    const handleInputChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        })
    }

    const handleFileChange = (e) => {
        const file = e.target.files?.[0]
        processFile(file)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        const file = e.dataTransfer.files?.[0]
        processFile(file)
    }

    const processFile = (file) => {
        if (!file) return

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
        if (!allowedTypes.includes(file.type)) {
            setError('Invalid file type. Please upload a JPEG, PNG, or PDF.')
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            setError('File too large. Maximum size is 5MB.')
            return
        }

        setError('')
        setVerificationFile(file)

        if (file.type.startsWith('image/')) {
            setFilePreview(URL.createObjectURL(file))
        } else {
            setFilePreview(null) // PDF — show icon instead
        }
    }

    const removeFile = () => {
        setVerificationFile(null)
        setFilePreview(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleSignUp = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        setMessage('')

        try {
            // Validate verification file
            if (!verificationFile) {
                throw new Error('Please upload your Certificate of Registration or Student ID for verification.')
            }

            // Custom Strict Email Validation (Check MX Records)
            const emailCheckRes = await fetch('/api/validate-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email })
            })
            const emailCheck = await emailCheckRes.json()
            if (!emailCheck.valid) {
                throw new Error(emailCheck.message || 'Please provide a valid, working email address.')
            }

            // Sign up the user
            const { data, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.fullName,
                        student_number: formData.studentNumber,
                    },
                },
            })

            if (authError) throw authError

            // Auto sign in
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email: formData.email,
                password: formData.password
            })

            if (signInError) throw signInError

            // Upload verification document via API
            const uploadForm = new FormData()
            uploadForm.append('file', verificationFile)

            const uploadRes = await fetch('/api/upload-verification', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${signInData.session.access_token}`,
                },
                body: uploadForm,
            })

            const uploadJson = await uploadRes.json()
            if (!uploadRes.ok) {
                console.error('Verification upload failed:', uploadJson.error)
                // Don't throw — account is created, doc upload can be retried from pending page
            }

            setMessage('Account created! Your verification is under review.')

            // Clear form
            setFormData({ fullName: '', studentNumber: '', email: '', password: '', loginIdentifier: '' })
            removeFile()

            // Redirect to pending verification page
            router.push('/pending-verification')

        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleSignIn = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            let email = formData.loginIdentifier

            // Check if user entered a student number format (0000-0000)
            if (/^\d{4}-\d{4}$/.test(formData.loginIdentifier)) {
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('email')
                    .eq('student_number', formData.loginIdentifier)
                    .maybeSingle() // Using maybeSingle to prevent coercion errors

                if (profileError || !profile) {
                    throw new Error('Student number not found. Please use email or register.')
                }

                email = profile.email
            }

            // Authenticate with email/password
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password: formData.password
            })

            if (authError) throw authError

            // Redirect to home upon success — useAuthGuard will check verification status
            router.push('/Home')
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, rgba(124, 45, 18, 0.2) 100%)' }} className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-black/40 backdrop-blur-2xl border border-orange-500/20 rounded-3xl p-8 shadow-2xl shadow-orange-500/10">
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <img src="/logo.png" alt="FoundIt Logo" className="w-20 h-20 rounded-2xl mix-blend-screen drop-shadow-[0_0_15px_rgba(249,115,22,0.4)]" />
                    </div>
                    <h1 className="text-5xl font-extrabold gradient-text mb-2 tracking-tight">FoundIt</h1>
                    <p className="text-orange-300/70 text-sm font-semibold">LSPU Lost and Found System</p>
                </div>

                {/* Toggle Buttons */}
                <div className="flex mb-6 bg-black/50 rounded-2xl p-1 border border-orange-500/10">
                    <button
                        type="button"
                        onClick={() => { setIsSignUp(false); setError(''); setMessage(''); }}
                        style={!isSignUp ? { background: 'linear-gradient(90deg, #ff6b35 0%, #ff8c42 100%)' } : {}}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${!isSignUp ? 'text-white shadow-lg shadow-orange-500/30' : 'text-orange-300/60 hover:text-orange-300'}`}
                    >
                        Sign In
                    </button>
                    <button
                        type="button"
                        onClick={() => { setIsSignUp(true); setError(''); setMessage(''); }}
                        style={isSignUp ? { background: 'linear-gradient(90deg, #ff6b35 0%, #ff8c42 100%)' } : {}}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${isSignUp ? 'text-white shadow-lg shadow-orange-500/30' : 'text-orange-300/60 hover:text-orange-300'}`}
                    >
                        Sign Up
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-500/15 border border-red-500/40 rounded-xl text-red-300 text-sm font-semibold animate-pulse">
                        {error}
                    </div>
                )}

                {message && (
                    <div className="mb-4 p-4 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-300 text-sm font-semibold">
                        {message}
                    </div>
                )}

                <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-4">
                    {isSignUp && (
                        <>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500/60 w-5 h-5 group-focus-within:text-orange-500 transition-colors" />
                                <input
                                    type="text"
                                    name="fullName"
                                    placeholder="Full Name"
                                    value={formData.fullName}
                                    onChange={handleInputChange}
                                    required={isSignUp}
                                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-orange-500/20 rounded-xl text-white placeholder-orange-300/40 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50 transition-all"
                                />
                            </div>

                            <div className="relative group">
                                <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500/60 w-5 h-5 group-focus-within:text-orange-500 transition-colors" />
                                <input
                                    type="text"
                                    name="studentNumber"
                                    placeholder="Student ID (0000-0000)"
                                    value={formData.studentNumber}
                                    onChange={handleInputChange}
                                    required={isSignUp}
                                    pattern="\d{4}-\d{4}"
                                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-orange-500/20 rounded-xl text-white placeholder-orange-300/40 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50 transition-all"
                                />
                            </div>
                        </>
                    )}

                    <div className="relative group">
                        {isSignUp ? <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500/60 w-5 h-5 group-focus-within:text-orange-500 transition-colors" /> : <User className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500/60 w-5 h-5 group-focus-within:text-orange-500 transition-colors" />}
                        <input
                            type={isSignUp ? "email" : "text"}
                            name={isSignUp ? "email" : "loginIdentifier"}
                            placeholder={isSignUp ? "LSPU or Personal Email" : "Email or Student ID"}
                            value={isSignUp ? formData.email : formData.loginIdentifier}
                            onChange={handleInputChange}
                            required
                            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-orange-500/20 rounded-xl text-white placeholder-orange-300/40 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50 transition-all"
                        />
                    </div>

                    <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500/60 w-5 h-5 group-focus-within:text-orange-500 transition-colors" />
                        <input
                            type="password"
                            name="password"
                            placeholder="Password"
                            value={formData.password}
                            onChange={handleInputChange}
                            required
                            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-orange-500/20 rounded-xl text-white placeholder-orange-300/40 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50 transition-all"
                        />
                    </div>

                    {/* Verification Document Upload — only on Sign Up */}
                    {isSignUp && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-400/80 ml-1">
                                Student Verification Document
                            </label>
                            <p className="text-[10px] text-white/30 ml-1 -mt-1">
                                Upload your Certificate of Registration (COR) or Student ID
                            </p>

                            {!verificationFile ? (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    onDrop={handleDrop}
                                    onDragOver={(e) => e.preventDefault()}
                                    className="flex flex-col items-center justify-center gap-3 p-6 bg-white/[0.03] border-2 border-dashed border-orange-500/20 rounded-2xl cursor-pointer hover:border-orange-500/40 hover:bg-white/[0.05] transition-all group"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                                        <Upload size={22} className="text-orange-500/60 group-hover:text-orange-500 transition-colors" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs font-bold text-white/50">Tap to upload or drag &amp; drop</p>
                                        <p className="text-[10px] text-white/20 mt-1">JPEG, PNG, or PDF — Max 5MB</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative flex items-center gap-3 p-4 bg-white/[0.05] border border-orange-500/30 rounded-2xl">
                                    {/* Preview */}
                                    {filePreview ? (
                                        <img
                                            src={filePreview}
                                            alt="Verification preview"
                                            className="w-14 h-14 rounded-xl object-cover border border-white/10 shrink-0"
                                        />
                                    ) : (
                                        <div className="w-14 h-14 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20">
                                            <FileText size={24} className="text-red-400" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-white truncate">{verificationFile.name}</p>
                                        <p className="text-[10px] text-white/30 mt-0.5">
                                            {(verificationFile.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={removeFile}
                                        className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors shrink-0"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            )}

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,application/pdf"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{ background: 'linear-gradient(90deg, #ff6b35 0%, #ff8c42 100%)' }}
                        className="w-full py-4 text-white font-bold rounded-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-orange-500/30 hover:opacity-90"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                Processing...
                            </span>
                        ) : (
                            isSignUp ? 'Create Account' : 'Sign In'
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
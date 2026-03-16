import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ztreloacqbwypkyotaqw.supabase.co'
const supabaseKey = 'sb_publishable_2wlgP2dxnJmqqPELVmwuwA_-Wyoq0vs'

export const supabase = createClient(supabaseUrl, supabaseKey)

# Parses every theme file with Shopify's own Liquid gem in strict mode, with
# the theme-platform tags registered as inert tags so only syntax is checked.
# Shopify's upload uses this parser, which is stricter than theme check (for
# example an output tag ends at the first "}").
#   gem install liquid && ruby scripts/theme-preview/liquid-check.rb '{AppName}'
require "liquid"

class InertBlock < Liquid::Block
  def render(_context) = ""
end
class InertTag < Liquid::Tag
  def render(_context) = ""
end
class RawBlock < Liquid::Raw
  def render(_context) = ""
end
env = Liquid::Environment.default
%w[form paginate style javascript stylesheet doc].each { |t| env.register_tag(t, InertBlock) }
env.register_tag("schema", RawBlock)
%w[section sections layout].each { |t| env.register_tag(t, InertTag) }

root = ARGV[0] || File.expand_path("../../{AppName}", __dir__)
files = Dir.glob(["sections/*.liquid", "snippets/*.liquid", "layout/*.liquid", "templates/**/*.liquid"], base: root).sort
bad = 0
files.each do |f|
  src = File.read(File.join(root, f), encoding: "UTF-8")
  begin
    Liquid::Template.parse(src, error_mode: :strict, line_numbers: true)
  rescue Liquid::Error => e
    bad += 1
    puts "#{f}: #{e.message}"
  end
end
puts "files with errors: #{bad} of #{files.size}"
exit(bad.zero? ? 0 : 1)
